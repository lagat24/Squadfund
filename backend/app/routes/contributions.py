"""PayPal Sandbox checkout. Nothing counts toward the ledger until the server verifies a completed capture."""
import logging

from flask import Blueprint, current_app, g, jsonify

from ..auth import login_required, require_member
from ..errors import ApiError, json_body, parse_cents
from ..extensions import db
from ..models import Contribution, Group, Membership
from ..money import fmt_money, paypal_value
from ..services import progress as pg
from ..services.paypal import PayPalError

bp = Blueprint("contributions", __name__, url_prefix="/api")
log = logging.getLogger("squadfund.payments")

MIN_CONTRIBUTION, MAX_CONTRIBUTION = 100, 500_000


def _paypal():
    pp = current_app.extensions["paypal"]
    if not pp.enabled:
        raise ApiError(503, "paypal_not_configured", "PayPal Sandbox keys are not set on this server yet. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable checkout.")
    return pp


def _custom_id(c):
    return f"sf-contribution-{c.id}"


def _result(c, **extra):
    return jsonify(contribution=pg.serialize_contribution(c), **extra)


def apply_paypal_result(c, order):
    """Verify a PayPal order payload against our own record and update the contribution.
    Returns True when the payload showed a capture we could evaluate."""
    unit = (order.get("purchase_units") or [{}])[0]
    captures = (unit.get("payments") or {}).get("captures") or []
    if not captures:
        c.paypal_status = order.get("status", c.paypal_status)
        return False
    cap = captures[0]
    amount = cap.get("amount") or {}
    if (unit.get("custom_id") != _custom_id(c) or amount.get("currency_code") != c.currency
            or amount.get("value") != paypal_value(c.amount_cents)):
        log.error("PayPal result mismatch for contribution %s", c.id)
        c.payment_status, c.failure_reason = "failed", "PayPal's result did not match this contribution, so nothing was recorded."
        c.paypal_status = cap.get("status") or "MISMATCH"
        return True
    c.paypal_capture_id = cap.get("id")
    c.paypal_status = cap.get("status")
    status = cap.get("status")
    if status == "COMPLETED" and order.get("status") == "COMPLETED":
        c.payment_status, c.failure_reason = "completed", None
    elif status == "PENDING":
        reason = (cap.get("status_details") or {}).get("reason")
        c.payment_status, c.failure_reason = "pending", f"PayPal is still processing this payment{f' ({reason})' if reason else ''}."
    elif status in ("REFUNDED", "PARTIALLY_REFUNDED"):
        c.payment_status, c.failure_reason = "released", "PayPal reports this payment was refunded."
    else:
        c.payment_status, c.failure_reason = "failed", "PayPal did not complete this payment."
    return True


@bp.post("/groups/<int:gid>/orders")
@login_required
def create_order(gid):
    group, m = require_member(gid, g.user)
    b = json_body()
    pp = _paypal()
    if group.status != "active":
        raise ApiError(409, "not_accepting", "This group is not accepting contributions right now.")
    if m.status != "active":
        raise ApiError(409, "paused", "Your plan is paused. Resume it on the plan page to contribute.")
    amount = parse_cents(b.get("amount_cents"), "Amount", MIN_CONTRIBUTION, MAX_CONTRIBUTION, "amount_cents")
    remaining = group.target_cents - pg.group_recorded(gid)
    if amount > remaining:
        raise ApiError(422, "over_target", f"The group only needs {fmt_money(remaining)} more. Enter that or less.", "amount_cents")
    c = Contribution(group_id=gid, user_id=g.user.id, amount_cents=amount, currency=group.currency, payment_status="pending", source="paypal_sandbox")
    db.session.add(c)
    db.session.flush()
    try:
        order = pp.create_order(amount, group.currency, f"group-{gid}", _custom_id(c),
                                f"SquadFund Sandbox contribution: {group.goal_title}", request_id=f"sf-order-{c.id}")
    except PayPalError as e:
        db.session.rollback()
        log.warning("create_order failed: %s", e)
        raise ApiError(502, "paypal_unavailable", "We could not start the PayPal checkout. Nothing was charged. Try again in a moment.")
    c.paypal_order_id, c.paypal_status = order["id"], order.get("status", "CREATED")
    db.session.commit()
    return jsonify(order_id=c.paypal_order_id, contribution_id=c.id), 201


def _own_contribution_by_order(order_id):
    c = Contribution.query.filter_by(paypal_order_id=order_id).with_for_update().first()
    if not c or c.user_id != g.user.id:
        raise ApiError(404, "not_found", "Payment not found.")
    return c


@bp.post("/orders/<order_id>/capture")
@login_required
def capture(order_id):
    c = _own_contribution_by_order(order_id)
    if c.payment_status == "completed":  # duplicate approval or retry: report, never double count
        return _result(c, duplicate=True)
    if c.payment_status in ("cancelled", "failed", "released"):
        raise ApiError(409, "closed", "This payment attempt is closed. Start a new contribution.")
    pp = _paypal()
    group = db.session.get(Group, c.group_id)
    m = Membership.query.filter_by(group_id=group.id, user_id=g.user.id).first()
    if group.status != "active" or not m or m.status != "active" or c.amount_cents > group.target_cents - pg.group_recorded(group.id):
        c.payment_status, c.failure_reason = "cancelled", "The group changed before this payment was captured, so it was not taken."
        db.session.commit()
        raise ApiError(409, "group_changed", "The group changed before your payment went through, so it was not captured. Nothing was charged.")
    try:
        order = pp.capture_order(order_id, request_id=f"sf-capture-{c.id}")
    except PayPalError as e:
        if "ORDER_ALREADY_CAPTURED" in e.issues:
            try:
                order = pp.get_order(order_id)
            except PayPalError:
                raise ApiError(502, "paypal_unavailable", "PayPal didn't answer. Use Check status in a moment; nothing is double counted.")
        elif "ORDER_NOT_APPROVED" in e.issues:
            raise ApiError(409, "not_approved", "PayPal says this order has not been approved yet. Finish approving it in the PayPal window.")
        elif {"INSTRUMENT_DECLINED", "PAYER_ACTION_REQUIRED"} & e.issues or e.status == 422:
            c.payment_status, c.failure_reason = "failed", "PayPal declined this payment. Try again or use a different Sandbox account."
            db.session.commit()
            return _result(c)
        else:
            log.warning("capture failed for contribution %s: %s", c.id, e)
            raise ApiError(502, "paypal_unavailable", "We could not confirm the payment with PayPal. Your contribution is still pending; use Check status to re-verify.")
    apply_paypal_result(c, order)
    if c.payment_status == "completed":
        pg.sync_group(group)
    db.session.commit()
    return _result(c)


@bp.post("/orders/<order_id>/cancel")
@login_required
def cancel(order_id):
    c = _own_contribution_by_order(order_id)
    if c.payment_status == "pending" and c.paypal_status in (None, "CREATED", "PAYER_ACTION_REQUIRED", "APPROVED"):
        c.payment_status, c.failure_reason = "cancelled", "You closed PayPal before approving. Nothing was charged."
        db.session.commit()
    return _result(c)


@bp.get("/contributions/<int:cid>")
@login_required
def get_contribution(cid):
    c = db.session.get(Contribution, cid)
    if not c:
        raise ApiError(404, "not_found", "Payment not found.")
    require_member(c.group_id, g.user)
    return _result(c)


@bp.post("/contributions/<int:cid>/refresh")
@login_required
def refresh(cid):
    c = db.session.get(Contribution, cid)
    if not c or c.user_id != g.user.id:
        raise ApiError(404, "not_found", "Payment not found.")
    if c.payment_status != "pending" or not c.paypal_order_id:
        return _result(c)
    pp = _paypal()
    try:
        order = pp.get_order(c.paypal_order_id)
    except PayPalError:
        raise ApiError(502, "paypal_unavailable", "PayPal didn't answer. Your payment status is unchanged; try again shortly.")
    apply_paypal_result(c, order)
    if c.payment_status == "completed":
        pg.sync_group(db.session.get(Group, c.group_id))
    db.session.commit()
    return _result(c)
