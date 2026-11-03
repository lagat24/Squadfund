import hashlib
from functools import wraps

from flask import g, session

from .errors import ApiError
from .extensions import db
from .models import Group, Membership, User


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def current_user():
    uid = session.get("uid")
    return db.session.get(User, uid) if uid else None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            raise ApiError(401, "auth_required", "Enter your name to continue.")
        g.user = user
        return fn(*args, **kwargs)

    return wrapper


def require_member(group_id, user):
    """Returns (group, membership). Non-members get 404 so group ids are not discoverable."""
    group = db.session.get(Group, group_id)
    m = Membership.query.filter_by(group_id=group_id, user_id=user.id).first() if group else None
    if not group or not m or m.status == "left":
        raise ApiError(404, "not_found", "Group not found.")
    return group, m


def require_owner(group, user):
    if group.owner_id != user.id:
        raise ApiError(403, "owner_only", "Only the group owner can do that.")
