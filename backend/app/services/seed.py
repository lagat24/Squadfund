"""Example data so a fresh install has something to explore. Clearly marked as seeded in the ledger."""
from datetime import datetime, timedelta, timezone

from ..extensions import db
from ..models import Contribution, Group, Membership, User
from . import progress as pg
from .rules import RULES_EXIT, RULES_MISSED_TARGET

DEMO_CODE = "DEMO-SQUAD"

# (member, amount in dollars, days ago)
_CONTRIBUTIONS = [
    ("Amara", 150, 26), ("Priya", 100, 24), ("Wanjiru", 120, 21), ("Amara", 150, 19), ("Diego", 60, 17),
    ("Priya", 150, 12), ("Wanjiru", 80, 9), ("Amara", 120, 8), ("Priya", 100, 3),
]


def seed_demo(force=False):
    existing = Group.query.filter_by(invite_code=DEMO_CODE).first()
    if existing and not force:
        return existing
    if existing:
        return existing  # never destroy data; remove the group manually to reseed
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    users = {}
    for name in ("Amara", "Priya", "Wanjiru", "Diego"):
        u = User(display_name=name)  # no resume token: seeded people can't be signed in as
        db.session.add(u)
        users[name] = u
    db.session.flush()

    group = Group(
        name="Study Squad Laptops",
        goal_title="6 refurbished laptops for our study group",
        description="Six of us need reliable laptops for the coming term. We are saving toward one bulk purchase.",
        target_cents=360_000, currency="USD", deadline=(now + timedelta(days=56)).date(), status="active",
        invite_code=DEMO_CODE, owner_id=users["Amara"].id, group_size=6, quantity=6,
        rules_missed_target=RULES_MISSED_TARGET, rules_exit=RULES_EXIT, created_at=now - timedelta(days=28),
    )
    db.session.add(group)
    db.session.flush()
    for name, u in users.items():
        db.session.add(Membership(group_id=group.id, user_id=u.id, personal_target_cents=60_000,
                                  role="owner" if name == "Amara" else "member", reminders_opt_in=name in ("Amara", "Priya"),
                                  joined_at=now - timedelta(days=27)))
    for name, dollars, days in _CONTRIBUTIONS:
        ts = now - timedelta(days=days)
        db.session.add(Contribution(group_id=group.id, user_id=users[name].id, amount_cents=dollars * 100, currency="USD",
                                    payment_status="completed", source="seed", created_at=ts, updated_at=ts))
    ts = now - timedelta(days=5)
    db.session.add(Contribution(group_id=group.id, user_id=users["Diego"].id, amount_cents=10_000, currency="USD",
                                payment_status="cancelled", source="seed", failure_reason="Closed before approving. Nothing was charged.",
                                created_at=ts, updated_at=ts))
    pg.replace_milestones(group, [25, 50, 75, 100], ["First quarter saved", "Halfway there", "Final stretch begins", "Target reached"])
    db.session.flush()
    db.session.refresh(group)
    pg.sync_group(group)
    db.session.commit()
    return group
