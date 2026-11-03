from datetime import datetime, timezone

from .extensions import db


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    display_name = db.Column(db.String(40), nullable=False)
    token_hash = db.Column(db.String(64), index=True)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)


class Group(db.Model):
    __tablename__ = "squad_groups"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    goal_title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, default="", nullable=False)
    target_cents = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(3), default="USD", nullable=False)
    deadline = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(24), default="active", nullable=False)
    invite_code = db.Column(db.String(16), unique=True, index=True, nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    group_size = db.Column(db.Integer, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    rules_missed_target = db.Column(db.Text, nullable=False)
    rules_exit = db.Column(db.Text, nullable=False)
    selected_offer_id = db.Column(db.Integer)
    purchased_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    owner = db.relationship("User", foreign_keys=[owner_id])
    milestones = db.relationship("Milestone", order_by="Milestone.position", cascade="all, delete-orphan")


class Membership(db.Model):
    __tablename__ = "memberships"
    __table_args__ = (db.UniqueConstraint("group_id", "user_id", name="uq_membership"),)
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("squad_groups.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    personal_target_cents = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(12), default="active", nullable=False)
    role = db.Column(db.String(10), default="member", nullable=False)
    reminders_opt_in = db.Column(db.Boolean, default=False, nullable=False)
    joined_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    user = db.relationship("User")


class Contribution(db.Model):
    __tablename__ = "contributions"
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("squad_groups.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    amount_cents = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(3), default="USD", nullable=False)
    payment_status = db.Column(db.String(16), default="pending", nullable=False)
    source = db.Column(db.String(20), default="paypal_sandbox", nullable=False)
    paypal_order_id = db.Column(db.String(64), unique=True)
    paypal_capture_id = db.Column(db.String(64), unique=True)
    paypal_status = db.Column(db.String(32))
    failure_reason = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = db.relationship("User")


class Milestone(db.Model):
    __tablename__ = "milestones"
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("squad_groups.id"), nullable=False, index=True)
    title = db.Column(db.String(80), nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    target_cents = db.Column(db.Integer, nullable=False)
    position = db.Column(db.Integer, default=0, nullable=False)
    status = db.Column(db.String(12), default="upcoming", nullable=False)


class SupplierOffer(db.Model):
    __tablename__ = "supplier_offers"
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("squad_groups.id"), nullable=False, index=True)
    supplier_label = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(240), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    list_total_cents = db.Column(db.Integer, nullable=False)
    quoted_total_cents = db.Column(db.Integer, nullable=False)
    is_simulated = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
