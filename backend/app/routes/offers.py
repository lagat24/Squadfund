from datetime import datetime, timezone

from flask import Blueprint, g, jsonify

from ..auth import login_required, require_member, require_owner
from ..errors import ApiError, json_body, parse_int
from ..extensions import db
from ..models import SupplierOffer
from ..services import progress as pg

bp = Blueprint("offers", __name__, url_prefix="/api")

NOTICE = "Simulated offers for demonstration. They are not real quotes, no supplier has been contacted, and nothing here can be ordered."


@bp.get("/groups/<int:gid>/offers")
@login_required
def list_offers(gid):
    group, _ = require_member(gid, g.user)
    stored = SupplierOffer.query.filter_by(group_id=gid).order_by(SupplierOffer.id).all()
    reached = group.status in ("target_reached", "purchase_simulated") and stored
    if reached:
        offers = [pg.serialize_offer(o) for o in stored]
    else:
        offers = [{**d, "id": None, "savings_cents": d["list_total_cents"] - d["quoted_total_cents"]} for d in pg.offer_drafts(group)]
    selected = next((o for o in offers if o["id"] and o["id"] == group.selected_offer_id), None)
    rec = pg.recorded_by_user(gid)
    members = [{"display_name": m.user.display_name, "recorded_cents": rec.get(m.user_id, 0)} for m in pg.members_of(group)]
    return jsonify(offers=offers, is_preview=not reached, status=group.status, selected_offer=selected, notice=NOTICE,
                   purchased_at=pg.iso(group.purchased_at), members=members, recorded_cents=sum(rec.values()),
                   target_cents=group.target_cents, goal_title=group.goal_title, quantity=group.quantity)


@bp.post("/groups/<int:gid>/purchase")
@login_required
def choose_offer(gid):
    group, _ = require_member(gid, g.user)
    require_owner(group, g.user)
    if group.status != "target_reached":
        raise ApiError(409, "not_ready", "The simulated purchase unlocks once the group reaches its target.")
    offer_id = parse_int(json_body().get("offer_id"), "Offer", 1, 10**9, "offer_id")
    offer = SupplierOffer.query.filter_by(id=offer_id, group_id=gid).first()
    if not offer:
        raise ApiError(404, "not_found", "That offer was not found.")
    group.selected_offer_id, group.status = offer.id, "purchase_simulated"
    group.purchased_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.commit()
    return jsonify(ok=True)
