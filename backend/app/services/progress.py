"""All money arithmetic, progress, pace and milestone logic lives here, in plain code."""
import math
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func

from ..extensions import db
from ..models import Contribution, Group, Membership, Milestone, SupplierOffer, utcnow
from ..money import ceil_div, round_up

DEFAULT_PERCENTS = [25, 50, 75, 100]
DEFAULT_TITLES = {25: "First quarter saved", 50: "Halfway there", 75: "Final stretch begins", 100: "Target reached"}
STALE_ORDER_HOURS = 2


def today():
    return datetime.now(timezone.utc).date()


def iso(dt):
    return dt.isoformat() + "Z" if dt else None


# ---- totals -----------------------------------------------------------------

def recorded_by_user(group_id):
    rows = (
        db.session.query(Contribution.user_id, func.coalesce(func.sum(Contribution.amount_cents), 0))
        .filter(Contribution.group_id == group_id, Contribution.payment_status == "completed")
        .group_by(Contribution.user_id)
        .all()
    )
    return {uid: int(total) for uid, total in rows}


def group_recorded(group_id):
    return sum(recorded_by_user(group_id).values())


def members_of(group, include_left=False):
    q = Membership.query.filter_by(group_id=group.id)
    if not include_left:
        q = q.filter(Membership.status != "left")
    return q.order_by(Membership.joined_at, Membership.id).all()


def percent(part, whole):
    return round(100 * part / whole, 1) if whole else 0.0


def timeline(group):
    start = group.created_at.date()
    total = max(1, (group.deadline - start).days)
    elapsed = min(max((today() - start).days, 0), total)
    return {
        "total_days": total,
        "elapsed_days": elapsed,
        "days_left": max(0, (group.deadline - today()).days),
        "fraction": elapsed / total,
    }


def pace_status(m, recorded, fraction):
    if m.status == "paused":
        return "paused"
    if recorded >= m.personal_target_cents:
        return "complete"
    expected = m.personal_target_cents * fraction
    if recorded >= max(expected * 1.15, 1) and recorded > 0:
        return "ahead"
    if recorded >= expected - 0.05 * m.personal_target_cents:
        return "on_pace"
    return "catching_up"


# ---- ledger hygiene ---------------------------------------------------------

def expire_stale_orders(group_id):
    """Orders created but never approved are cancelled after a while. Nothing was recorded for them."""
    cutoff = utcnow() - timedelta(hours=STALE_ORDER_HOURS)
    stale = Contribution.query.filter(
        Contribution.group_id == group_id,
        Contribution.payment_status == "pending",
        Contribution.paypal_status == "CREATED",
        Contribution.created_at < cutoff,
    ).all()
    for c in stale:
        c.payment_status = "cancelled"
        c.failure_reason = "The PayPal approval was not completed in time."
    if stale:
        db.session.commit()


# ---- milestones -------------------------------------------------------------

def milestone_point(group, pct, start=None):
    """Cumulative amount and due date for a checkpoint at pct percent. Pure arithmetic."""
    t0 = start or today()
    span = max(1, (group.deadline - t0).days)
    cents = group.target_cents if pct >= 100 else (group.target_cents * pct) // 100
    due = group.deadline if pct >= 100 else t0 + timedelta(days=round(span * pct / 100))
    return cents, due


def replace_milestones(group, percents, titles):
    """Turn percentage checkpoints into dated, cumulative-amount milestones."""
    Milestone.query.filter_by(group_id=group.id).delete()
    db.session.flush()
    for i, (p, title) in enumerate(zip(percents, titles)):
        cents, due = milestone_point(group, p)
        db.session.add(Milestone(group_id=group.id, title=title, due_date=due, target_cents=cents, position=i))
    db.session.flush()


def default_milestones(group):
    replace_milestones(group, DEFAULT_PERCENTS, [DEFAULT_TITLES[p] for p in DEFAULT_PERCENTS])


def milestone_percents(group):
    return [(m.title, percent(m.target_cents, group.target_cents)) for m in group.milestones]


# ---- simulated supplier offers ----------------------------------------------

_OFFER_TEMPLATES = [
    ("Example Supplier A", 600, "Standard bulk tier. Delivery in about 10 days (simulated)."),
    ("Example Supplier B", 850, "Volume tier with a 12-month warranty line (simulated)."),
    ("Example Supplier C", 1000, "Best simulated price, longer lead time of about 21 days."),
]


def offer_drafts(group):
    out = []
    for label, bps, note in _OFFER_TEMPLATES:
        out.append({
            "supplier_label": label,
            "description": note,
            "quantity": group.quantity,
            "list_total_cents": group.target_cents,
            "quoted_total_cents": group.target_cents * (10000 - bps) // 10000,
            "is_simulated": True,
        })
    return out


def ensure_offers(group):
    if SupplierOffer.query.filter_by(group_id=group.id).first():
        return
    for d in offer_drafts(group):
        db.session.add(SupplierOffer(group_id=group.id, **d))


def serialize_offer(o):
    return {
        "id": o.id,
        "supplier_label": o.supplier_label,
        "description": o.description,
        "quantity": o.quantity,
        "list_total_cents": o.list_total_cents,
        "quoted_total_cents": o.quoted_total_cents,
        "savings_cents": o.list_total_cents - o.quoted_total_cents,
        "is_simulated": True,
    }


# ---- sync -------------------------------------------------------------------

def sync_group(group):
    """Recompute milestone status and group status from the verified ledger."""
    rec = group_recorded(group.id)
    for ms in group.milestones:
        ms.status = "reached" if rec >= ms.target_cents else "upcoming"
    if group.status in ("active", "target_reached"):
        if rec >= group.target_cents:
            group.status = "target_reached"
            ensure_offers(group)
        else:
            group.status = "active"


# ---- schedules and adjustment options ----------------------------------------

def weekly_schedule(group):
    t = timeline(group)
    weeks_left = max(1, ceil_div(t["days_left"], 7))
    rec = recorded_by_user(group.id)
    rows = []
    for m in members_of(group):
        remaining = max(0, m.personal_target_cents - rec.get(m.user_id, 0))
        rows.append({
            "user_id": m.user_id,
            "display_name": m.user.display_name,
            "status": m.status,
            "personal_target_cents": m.personal_target_cents,
            "recorded_cents": rec.get(m.user_id, 0),
            "remaining_cents": remaining,
            "weekly_cents": ceil_div(remaining, weeks_left) if m.status == "active" else 0,
        })
    return {"weeks_left": weeks_left, "members": rows}


def adjustment_options(group, m):
    """Concrete, human-applied options. The AI may pick among these; it never invents amounts."""
    t = timeline(group)
    rec = recorded_by_user(group.id)
    mine = rec.get(m.user_id, 0)
    total = sum(rec.values())
    remaining = max(0, m.personal_target_cents - mine)
    weeks_left = max(1, ceil_div(t["days_left"], 7))
    status = pace_status(m, mine, t["fraction"])
    opts = {"smaller_steps": None, "lower_personal_target": None, "extend_deadline": None}

    if remaining > 0 and m.status == "active":
        steps = min(max(weeks_left, 2), 12)
        opts["smaller_steps"] = {"steps": steps, "step_cents": round_up(ceil_div(remaining, steps), 100), "cadence": "weekly"}

    if status == "catching_up" and mine > 0:
        if t["elapsed_days"] >= 7:
            projected = int(mine * t["total_days"] / t["elapsed_days"])
        else:
            projected = mine + int(remaining * 0.6)
        suggested = max(mine, round_up(projected, 500), 100)
        if suggested < m.personal_target_cents:
            opts["lower_personal_target"] = {"suggested_cents": suggested}

    if t["elapsed_days"] >= 7 and total > 0 and group.status == "active":
        rate = total / t["elapsed_days"]
        days_needed = math.ceil((group.target_cents - total) / rate) if rate else None
        if days_needed is not None:
            projected_end = today() + timedelta(days=int(days_needed))
            if projected_end > group.deadline:
                extra = ceil_div((projected_end - group.deadline).days, 7) * 7
                opts["extend_deadline"] = {"suggested_date": (group.deadline + timedelta(days=extra)).isoformat(), "extra_days": extra}
    return {"status": status, "options": opts}


# ---- serializers -------------------------------------------------------------

def serialize_group_public(group):
    return {
        "id": group.id,
        "name": group.name,
        "goal_title": group.goal_title,
        "description": group.description,
        "target_cents": group.target_cents,
        "currency": group.currency,
        "deadline": group.deadline.isoformat(),
        "status": group.status,
        "group_size": group.group_size,
        "quantity": group.quantity,
        "rules_missed_target": group.rules_missed_target,
        "rules_exit": group.rules_exit,
        "created_at": iso(group.created_at),
    }


def serialize_contribution(c):
    return {
        "id": c.id,
        "group_id": c.group_id,
        "user_id": c.user_id,
        "display_name": c.user.display_name if c.user else "Member",
        "amount_cents": c.amount_cents,
        "currency": c.currency,
        "payment_status": c.payment_status,
        "source": c.source,
        "paypal_order_id": c.paypal_order_id,
        "paypal_capture_id": c.paypal_capture_id,
        "paypal_status": c.paypal_status,
        "failure_reason": c.failure_reason,
        "created_at": iso(c.created_at),
        "updated_at": iso(c.updated_at),
    }


def dashboard(group, me):
    expire_stale_orders(group.id)
    t = timeline(group)
    rec = recorded_by_user(group.id)
    total = sum(rec.values())
    members = members_of(group)
    rows = []
    for m in members:
        r = rec.get(m.user_id, 0)
        rows.append({
            "user_id": m.user_id,
            "display_name": m.user.display_name,
            "role": m.role,
            "status": m.status,
            "personal_target_cents": m.personal_target_cents,
            "recorded_cents": r,
            "percent": percent(r, m.personal_target_cents),
            "pace": pace_status(m, r, t["fraction"]),
        })
    plan_cover = sum(m.personal_target_cents for m in members if m.status == "active")
    open_spots = max(0, group.group_size - len(members))
    expected = int(group.target_cents * t["fraction"])
    mine = next((r for r in rows if r["user_id"] == me.id), None)
    recent = (
        Contribution.query.filter_by(group_id=group.id)
        .order_by(Contribution.created_at.desc(), Contribution.id.desc()).limit(5).all()
    )
    return {
        "group": {**serialize_group_public(group), "invite_code": group.invite_code, "owner_id": group.owner_id,
                  "selected_offer_id": group.selected_offer_id, "purchased_at": iso(group.purchased_at)},
        "totals": {
            "recorded_cents": total,
            "target_cents": group.target_cents,
            "percent": min(100.0, percent(total, group.target_cents)),
            "remaining_cents": max(0, group.target_cents - total),
            "plan_coverage_cents": plan_cover,
            "plan_shortfall_cents": max(0, group.target_cents - plan_cover),
            "open_spots": open_spots,
            "per_open_spot_cents": ceil_div(max(0, group.target_cents - plan_cover), open_spots) if open_spots else 0,
            "days_left": t["days_left"],
            "expected_cents": expected,
            "expected_percent": percent(expected, group.target_cents),
            "reminder_opt_ins": sum(1 for m in members if m.reminders_opt_in),
        },
        "members": rows,
        "milestones": [
            {"id": ms.id, "title": ms.title, "due_date": ms.due_date.isoformat(), "target_cents": ms.target_cents,
             "percent": percent(ms.target_cents, group.target_cents), "status": ms.status}
            for ms in group.milestones
        ],
        "me": {**(mine or {}), "reminders_opt_in": next((m.reminders_opt_in for m in members if m.user_id == me.id), False),
               "remaining_cents": max(0, (mine or {}).get("personal_target_cents", 0) - (mine or {}).get("recorded_cents", 0)),
               "weekly_cents": ceil_div(max(0, (mine or {}).get("personal_target_cents", 0) - (mine or {}).get("recorded_cents", 0)),
                                        max(1, ceil_div(t["days_left"], 7)))},
        "recent_contributions": [serialize_contribution(c) for c in recent],
    }
