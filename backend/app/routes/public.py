from flask import Blueprint, current_app, jsonify

from ..models import Group
from ..services import llm
from ..services.progress import group_recorded, members_of, percent
from ..services.rules import SANDBOX_DISCLOSURE

bp = Blueprint("public", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    return jsonify(ok=True)


@bp.get("/config")
def config():
    pp = current_app.extensions["paypal"]
    return jsonify(
        currency=current_app.config["CURRENCY"],
        paypal={"enabled": pp.enabled, "client_id": pp.client_id if pp.enabled else None},
        ai={"enabled": llm.configured()},
        disclosure=SANDBOX_DISCLOSURE,
    )


@bp.get("/demo")
def demo():
    """Public, read-only snapshot of the seeded example group for the landing page."""
    group = Group.query.filter_by(invite_code="DEMO-SQUAD").first()
    if not group:
        return jsonify(group=None)
    rec = group_recorded(group.id)
    return jsonify(group={
        "name": group.name,
        "goal_title": group.goal_title,
        "invite_code": group.invite_code,
        "target_cents": group.target_cents,
        "recorded_cents": rec,
        "percent": percent(rec, group.target_cents),
        "deadline": group.deadline.isoformat(),
        "members": len(members_of(group)),
        "group_size": group.group_size,
        "milestones": [{"title": m.title, "percent": percent(m.target_cents, group.target_cents), "status": m.status} for m in group.milestones],
    })
