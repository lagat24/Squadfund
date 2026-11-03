from flask import Blueprint, current_app, g, jsonify

from ..auth import login_required, require_member
from ..errors import ApiError, json_body
from ..services import assist, ratelimit

bp = Blueprint("ai", __name__, url_prefix="/api/groups/<int:gid>/ai")


def _guard(gid):
    group, m = require_member(gid, g.user)
    if not ratelimit.allow(f"ai:{g.user.id}", current_app.config["AI_CALLS_PER_HOUR"]):
        raise ApiError(429, "rate_limited", "That's a lot of AI requests for one hour. Take a short break and try again.")
    return group, m


@bp.post("/milestones")
@login_required
def milestones(gid):
    group, _ = _guard(gid)
    return jsonify(assist.milestone_plan(group))


@bp.post("/coach")
@login_required
def coach(gid):
    group, m = _guard(gid)
    return jsonify(assist.coach(group, m))


@bp.post("/update")
@login_required
def update(gid):
    group, _ = _guard(gid)
    return jsonify(assist.group_update(group))


@bp.post("/reminder")
@login_required
def reminder(gid):
    group, m = _guard(gid)
    return jsonify(assist.reminder(group, m, json_body().get("audience")))
