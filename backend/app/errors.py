import logging
import re
from datetime import date

from flask import jsonify, request

from .money import fmt_money

log = logging.getLogger("squadfund")

_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


class ApiError(Exception):
    def __init__(self, status, code, message, field=None):
        super().__init__(message)
        self.status, self.code, self.message, self.field = status, code, message, field


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def _api_error(e):
        return jsonify(error={"code": e.code, "message": e.message, "field": e.field}), e.status

    @app.errorhandler(404)
    def _not_found(e):
        return jsonify(error={"code": "not_found", "message": "Not found.", "field": None}), 404

    @app.errorhandler(405)
    def _method(e):
        return jsonify(error={"code": "method_not_allowed", "message": "That action is not allowed here.", "field": None}), 405

    @app.errorhandler(413)
    def _too_big(e):
        return jsonify(error={"code": "too_large", "message": "That request is too large.", "field": None}), 413

    @app.errorhandler(Exception)
    def _unexpected(e):
        from werkzeug.exceptions import HTTPException

        if isinstance(e, HTTPException):
            return jsonify(error={"code": "http_error", "message": e.description, "field": None}), e.code
        log.exception("Unhandled error on %s %s", request.method, request.path)
        return jsonify(error={"code": "server_error", "message": "Something went wrong on our side. Try again in a moment.", "field": None}), 500


def json_body():
    if not request.is_json:
        raise ApiError(415, "json_required", "Send the request as JSON.")
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError(400, "bad_json", "The request body must be a JSON object.")
    return data


def clean_text(value, label, min_len=1, max_len=100, required=True, field=None):
    field = field or label
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ApiError(422, "invalid", f"{label} is required.", field)
        return ""
    if not isinstance(value, str):
        raise ApiError(422, "invalid", f"{label} must be text.", field)
    text = _CONTROL.sub("", value).strip()
    if len(text) < min_len:
        raise ApiError(422, "invalid", f"{label} needs at least {min_len} characters.", field)
    if len(text) > max_len:
        raise ApiError(422, "invalid", f"{label} can be at most {max_len} characters.", field)
    return text


def parse_int(value, label, lo, hi, field=None):
    if isinstance(value, bool) or not isinstance(value, int):
        raise ApiError(422, "invalid", f"{label} must be a whole number.", field or label)
    if value < lo or value > hi:
        raise ApiError(422, "invalid", f"{label} must be between {lo} and {hi}.", field or label)
    return value


def parse_cents(value, label, lo, hi, field=None):
    if isinstance(value, bool) or not isinstance(value, int):
        raise ApiError(422, "invalid", f"Enter {label.lower()} as a dollar amount.", field or label)
    if value < lo or value > hi:
        raise ApiError(422, "invalid", f"{label} must be between {fmt_money(lo)} and {fmt_money(hi)}.", field or label)
    return value


def parse_date(value, label, field=None):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ApiError(422, "invalid", f"{label} must be a valid date.", field or label)
