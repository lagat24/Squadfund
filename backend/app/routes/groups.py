import secrets
from datetime import timedelta

from flask import Blueprint, g, jsonify

from ..auth import login_required, require_member, require_owner
from ..errors import ApiError, clean_text, json_body, parse_cents, parse_date, parse_int
from ..extensions import db
from ..models import Contribution, Group, Membership, User
from ..money import fmt_money
from ..services import progress as pg
from ..services.rules import RULES_EXIT, RULES_MISSED_TARGET

bp = Blueprint("groups", __name__, url_prefix="/api")

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
MIN_TARGET, MAX_TARGET = 5_000, 5_000_000


def _new_code():
    while True:
        raw = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
        code = f"{raw[:4]}-{raw[4:]}"
        if not Group.query.filter_by(invite_code=code).first():
            return code


def _normalize_code(code):
    return (code or "").strip().upper().replace(" ", "")


def _owner_row(group):
    return Membership.query.filter_by(group_id=group.id, user_id=group.owner_id).first()


@bp.post("/groups")
@login_required
def create_group():
    b = json_body()
    name = clean_text(b.get("name"), "Group name", 3, 80, field="name")
    goal = clean_text(b.get("goal_title"), "Purchase", 3, 120, field="goal_title")
    desc = clean_text(b.get("description"), "Description", 0, 500, required=False, field="description")
    target = parse_cents(b.get("target_cents"), "Target amount", MIN_TARGET, MAX_TARGET, "target_cents")
    deadline = parse_date(b.get("deadline"), "Deadline", "deadline")
    if not (pg.today() + timedelta(days=7) <= deadline <= pg.today() + timedelta(days=730)):
        raise ApiError(422, "invalid", "Choose a deadline between one week and two years from today.", "deadline")
    size = parse_int(b.get("group_size"), "Group size", 2, 30, "group_size")
    qty = parse_int(b.get("quantity", size), "Number of items", 1, 500, "quantity")
    mine = parse_cents(b.get("personal_target_cents"), "Your target", 100, target, "personal_target_cents")

    group = Group(name=name, goal_title=goal, description=desc, target_cents=target, deadline=deadline,
                  currency="USD", invite_code=_new_code(), owner_id=g.user.id, group_size=size, quantity=qty,
                  rules_missed_target=RULES_MISSED_TARGET, rules_exit=RULES_EXIT)
    db.session.add(group)
    db.session.flush()
    db.session.add(Membership(group_id=group.id, user_id=g.user.id, personal_target_cents=mine, role="owner"))
    pg.default_milestones(group)
    db.session.commit()
    return jsonify(group_id=group.id, invite_code=group.invite_code), 201


@bp.get("/groups")
@login_required
def my_groups():
    rows = (db.session.query(Group, Membership).join(Membership, Membership.group_id == Group.id)
            .filter(Membership.user_id == g.user.id, Membership.status != "left")
            .order_by(Group.created_at.desc()).all())
    out = []
    for group, m in rows:
        rec = pg.group_recorded(group.id)
        out.append({**pg.serialize_group_public(group), "role": m.role, "my_status": m.status, "recorded_cents": rec,
                    "percent": min(100.0, pg.percent(rec, group.target_cents)),
                    "member_count": len(pg.members_of(group))})
    return jsonify(groups=out)


@bp.get("/invites/<code>")
def invite_preview(code):
    from ..auth import current_user

    group = Group.query.filter_by(invite_code=_normalize_code(code)).first()
    if not group:
        raise ApiError(404, "invite_not_found", "We could not find a group with that code. Check it and try again.")
    members = pg.members_of(group)
    user = current_user()
    existing = Membership.query.filter_by(group_id=group.id, user_id=user.id).first() if user else None
    return jsonify(
        group={**pg.serialize_group_public(group), "owner_name": group.owner.display_name,
               "member_count": len(members), "spots_left": max(0, group.group_size - len(members)),
               "suggested_target_cents": -(-group.target_cents // group.group_size)},
        joinable=group.status == "active" and len(members) < group.group_size,
        already_member=bool(existing and existing.status != "left"),
        group_id=group.id if existing and existing.status != "left" else None,
    )


@bp.post("/invites/<code>/join")
@login_required
def join(code):
    b = json_body()
    group = Group.query.filter_by(invite_code=_normalize_code(code)).first()
    if not group:
        raise ApiError(404, "invite_not_found", "We could not find a group with that code.")
    if b.get("accepted_rules") is not True:
        raise ApiError(422, "rules_required", "Confirm that you have read the group rules to join.", "accepted_rules")
    if group.status != "active":
        raise ApiError(409, "not_joinable", "This group is no longer accepting new members.")
    mine = parse_cents(b.get("personal_target_cents"), "Your target", 100, group.target_cents, "personal_target_cents")
    existing = Membership.query.filter_by(group_id=group.id, user_id=g.user.id).first()
    if existing and existing.status != "left":
        raise ApiError(409, "already_member", "You are already in this group.")
    if len(pg.members_of(group)) >= group.group_size:
        raise ApiError(409, "group_full", "This group is full.")
    if existing:
        existing.status, existing.personal_target_cents = "active", mine
    else:
        db.session.add(Membership(group_id=group.id, user_id=g.user.id, personal_target_cents=mine))
    db.session.commit()
    return jsonify(group_id=group.id), 201


@bp.get("/groups/<int:gid>")
@login_required
def get_group(gid):
    group, _ = require_member(gid, g.user)
    return jsonify(pg.dashboard(group, g.user))


@bp.patch("/groups/<int:gid>")
@login_required
def edit_group(gid):
    group, _ = require_member(gid, g.user)
    require_owner(group, g.user)
    b = json_body()
    if group.status not in ("active", "target_reached"):
        raise ApiError(409, "locked", "This group can no longer be edited.")
    others = len(pg.members_of(group)) > 1
    changed_money_or_time = False
    if "name" in b:
        group.name = clean_text(b["name"], "Group name", 3, 80, field="name")
    if "description" in b:
        group.description = clean_text(b["description"], "Description", 0, 500, required=False, field="description")
    if "target_cents" in b:
        new = parse_cents(b["target_cents"], "Target amount", MIN_TARGET, MAX_TARGET, "target_cents")
        if others and new > group.target_cents:
            raise ApiError(422, "fairness", "Once others have joined, the target can only be lowered, not raised.", "target_cents")
        changed_money_or_time |= new != group.target_cents
        group.target_cents = new
    if "deadline" in b:
        new = parse_date(b["deadline"], "Deadline", "deadline")
        if new > pg.today() + timedelta(days=730):
            raise ApiError(422, "invalid", "The deadline can be at most two years away.", "deadline")
        if others and new < group.deadline:
            raise ApiError(422, "fairness", "Once others have joined, the deadline can only be extended, not shortened.", "deadline")
        if new <= pg.today():
            raise ApiError(422, "invalid", "The deadline must be in the future.", "deadline")
        changed_money_or_time |= new != group.deadline
        group.deadline = new
    if changed_money_or_time:
        keep = [(m.title, m.target_cents) for m in group.milestones]
        old_target = max((c for _, c in keep), default=0) or 1
        by_pct = {min(100, max(1, round(100 * c / old_target))): t for t, c in keep}
        pcts = sorted(set(by_pct) | {100})
        titles = [by_pct.get(p) or pg.DEFAULT_TITLES.get(p, f"Reach {p}% of the target") for p in pcts]
        pg.replace_milestones(group, pcts, titles)
        db.session.flush()
        db.session.refresh(group)
    if group.status == "target_reached" and pg.group_recorded(group.id) < group.target_cents:
        group.status = "active"
    pg.sync_group(group)
    db.session.commit()
    return jsonify(pg.dashboard(group, g.user))


@bp.patch("/groups/<int:gid>/membership")
@login_required
def edit_membership(gid):
    group, m = require_member(gid, g.user)
    b = json_body()
    if "personal_target_cents" in b:
        if group.status not in ("active", "target_reached"):
            raise ApiError(409, "locked", "Targets can't be changed after the purchase step.")
        m.personal_target_cents = parse_cents(b["personal_target_cents"], "Your target", 100, group.target_cents, "personal_target_cents")
    if "status" in b:
        if b["status"] not in ("active", "paused"):
            raise ApiError(422, "invalid", "Status must be active or paused.", "status")
        m.status = b["status"]
    if "reminders_opt_in" in b:
        if not isinstance(b["reminders_opt_in"], bool):
            raise ApiError(422, "invalid", "Reminders must be on or off.", "reminders_opt_in")
        m.reminders_opt_in = b["reminders_opt_in"]
    db.session.commit()
    return jsonify(pg.dashboard(group, g.user))


@bp.post("/groups/<int:gid>/leave")
@login_required
def leave(gid):
    group, m = require_member(gid, g.user)
    if group.status == "purchase_simulated":
        raise ApiError(409, "locked", "The simulated purchase is complete, so the group can't change anymore.")
    for c in Contribution.query.filter_by(group_id=gid, user_id=g.user.id, payment_status="completed").all():
        c.payment_status = "released"
        c.failure_reason = "Released to the member when they left the group."
    m.status = "left"
    if group.owner_id == g.user.id:
        heir = next((x for x in pg.members_of(group) if x.user_id != g.user.id), None)
        if heir:
            group.owner_id, heir.role, m.role = heir.user_id, "owner", "member"
        else:
            group.status = "closed"
    pg.sync_group(group)
    db.session.commit()
    return jsonify(ok=True)


@bp.put("/groups/<int:gid>/milestones")
@login_required
def set_milestones(gid):
    group, _ = require_member(gid, g.user)
    require_owner(group, g.user)
    if group.status != "active":
        raise ApiError(409, "locked", "Milestones can only be changed while the group is saving.")
    items = json_body().get("milestones")
    if not isinstance(items, list) or not (2 <= len(items) <= 6):
        raise ApiError(422, "invalid", "Provide between 2 and 6 milestones.", "milestones")
    pcts, titles = [], []
    for it in items:
        if not isinstance(it, dict):
            raise ApiError(422, "invalid", "Each milestone needs a title and percent.", "milestones")
        titles.append(clean_text(it.get("title"), "Milestone title", 3, 60, field="milestones"))
        pcts.append(parse_int(it.get("percent"), "Milestone percent", 1, 100, "milestones"))
    if pcts != sorted(set(pcts)) or pcts[-1] != 100:
        raise ApiError(422, "invalid", "Milestone percentages must increase and the last must be 100.", "milestones")
    pg.replace_milestones(group, pcts, titles)
    db.session.flush()
    db.session.refresh(group)
    pg.sync_group(group)
    db.session.commit()
    return jsonify(pg.dashboard(group, g.user))


@bp.get("/groups/<int:gid>/contributions")
@login_required
def ledger(gid):
    group, _ = require_member(gid, g.user)
    pg.expire_stale_orders(gid)
    rows = Contribution.query.filter_by(group_id=gid).order_by(Contribution.created_at.desc(), Contribution.id.desc()).limit(300).all()
    totals = pg.recorded_by_user(gid)
    return jsonify(contributions=[pg.serialize_contribution(c) for c in rows], recorded_cents=sum(totals.values()))
