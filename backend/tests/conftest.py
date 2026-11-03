import itertools
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.services.paypal import PayPalError  # noqa: E402


class FakePayPal:
    """Stands in for PayPal Sandbox so tests never touch the network."""

    enabled = True
    client_id = "test-client-id"

    def __init__(self):
        self.orders, self.ids = {}, itertools.count(1)
        self.capture_mode = "COMPLETED"  # or PENDING, MISMATCH, DECLINED
        self.capture_calls = 0

    def create_order(self, amount_cents, currency, reference_id, custom_id, description, request_id):
        oid = f"ORDER{next(self.ids)}"
        self.orders[oid] = {"amount": f"{amount_cents // 100}.{amount_cents % 100:02d}", "currency": currency, "custom_id": custom_id, "captured": False}
        return {"id": oid, "status": "CREATED"}

    def _payload(self, oid, status="COMPLETED", cap_status="COMPLETED", amount=None):
        o = self.orders[oid]
        return {"id": oid, "status": status, "purchase_units": [{"custom_id": o["custom_id"], "payments": {"captures": [
            {"id": f"CAP-{oid}", "status": cap_status, "amount": {"currency_code": o["currency"], "value": amount or o["amount"]}}]}}]}

    def capture_order(self, order_id, request_id):
        self.capture_calls += 1
        if self.orders[order_id]["captured"]:
            raise PayPalError("already", code="UNPROCESSABLE_ENTITY", status=422, details=[{"issue": "ORDER_ALREADY_CAPTURED"}])
        if self.capture_mode == "DECLINED":
            raise PayPalError("declined", code="UNPROCESSABLE_ENTITY", status=422, details=[{"issue": "INSTRUMENT_DECLINED"}])
        self.orders[order_id]["captured"] = True
        if self.capture_mode == "PENDING":
            return self._payload(order_id, "COMPLETED", "PENDING")
        if self.capture_mode == "MISMATCH":
            return self._payload(order_id, amount="1.00")
        return self._payload(order_id)

    def get_order(self, order_id):
        o = self.orders[order_id]
        if not o["captured"]:
            return {"id": order_id, "status": "APPROVED", "purchase_units": [{"custom_id": o["custom_id"]}]}
        return self._payload(order_id)


@pytest.fixture()
def app():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite://", "SEED_DEMO_DATA": False,
                      "ANTHROPIC_API_KEY": "", "SQLALCHEMY_ENGINE_OPTIONS": {}})
    app.extensions["paypal"] = FakePayPal()
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def make_client(app, name):
    c = app.test_client()
    r = c.post("/api/auth/session", json={"display_name": name})
    assert r.status_code == 201
    return c


@pytest.fixture()
def squad(app):
    """Owner (Ada) with a group, plus a second member (Ben) who has joined."""
    ada, ben = make_client(app, "Ada"), make_client(app, "Ben")
    r = ada.post("/api/groups", json={"name": "Laptop crew", "goal_title": "4 laptops", "target_cents": 200_000,
                                        "deadline": "2099-01-01", "group_size": 4, "personal_target_cents": 50_000})
    assert r.status_code == 422  # deadline too far: checks the two-year limit
    from datetime import date, timedelta
    deadline = (date.today() + timedelta(days=60)).isoformat()
    r = ada.post("/api/groups", json={"name": "Laptop crew", "goal_title": "4 laptops", "target_cents": 200_000,
                                        "deadline": deadline, "group_size": 4, "personal_target_cents": 50_000})
    assert r.status_code == 201, r.get_json()
    gid, code = r.get_json()["group_id"], r.get_json()["invite_code"]
    r = ben.post(f"/api/invites/{code}/join", json={"personal_target_cents": 50_000, "accepted_rules": True})
    assert r.status_code == 201
    return {"ada": ada, "ben": ben, "gid": gid, "code": code}
