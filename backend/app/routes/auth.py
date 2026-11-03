import secrets

from flask import Blueprint, jsonify, session

from ..auth import current_user, hash_token
from ..errors import ApiError, clean_text, json_body
from ..extensions import db
from ..models import User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _user(u):
    return {"id": u.id, "display_name": u.display_name}


def _start_session(user):
    session.clear()
    session["uid"] = user.id
    session.permanent = True


@bp.post("/session")
def sign_up():
    name = clean_text(json_body().get("display_name"), "Your name", 2, 40, field="display_name")
    token = secrets.token_urlsafe(32)
    user = User(display_name=name, token_hash=hash_token(token))
    db.session.add(user)
    db.session.commit()
    _start_session(user)
    return jsonify(user=_user(user), resume_token=token), 201


@bp.post("/resume")
def resume():
    token = json_body().get("token")
    user = User.query.filter_by(token_hash=hash_token(token)).first() if isinstance(token, str) and token else None
    if not user:
        raise ApiError(401, "invalid_token", "That saved identity is no longer available. Enter your name again.")
    _start_session(user)
    return jsonify(user=_user(user))


@bp.get("/me")
def me():
    user = current_user()
    return jsonify(user=_user(user) if user else None)


@bp.delete("/session")
def sign_out():
    session.clear()
    return jsonify(ok=True)
