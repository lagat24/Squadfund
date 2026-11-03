from datetime import date, timedelta

from app.extensions import db
from app.models import Contribution

from .conftest import make_client


def pay(client, gid, cents):
    r = client.post(f"/api/groups/{gid}/orders", json={"amount_cents": cents})
    assert r.status_code == 201, r.get_json()
    return r.get_json()


def test_identity_validation_and_session(app):
    c = app.test_client()
    assert c.get("/api/auth/me").get_json()["user"] is None
    assert c.post("/api/auth/session", json={"display_name": "x"}).status_code == 422
    assert c.post("/api/auth/session", data="display_name=Ada").status_code == 415
    r = c.post("/api/auth/session", json={"display_name": "  Ada  "})
    assert r.get_json()["user"]["display_name"] == "Ada"
    token = r.get_json()["resume_token"]
    c.delete("/api/auth/session")
    assert c.get("/api/groups").status_code == 401
    assert c.post("/api/auth/resume", json={"token": token}).status_code == 200
    assert c.post("/api/auth/resume", json={"token": "nope"}).status_code == 401


def test_group_create_default_milestones_and_rules(squad):
    d = squad["ada"].get(f"/api/groups/{squad['gid']}").get_json()
    assert [m["percent"] for m in d["milestones"]] == [25.0, 50.0, 75.0, 100.0]
    assert d["milestones"][-1]["target_cents"] == 200_000
    assert d["totals"]["recorded_cents"] == 0 and d["totals"]["open_spots"] == 2
    assert "penalty" in d["group"]["rules_missed_target"]
    assert len(d["members"]) == 2


def test_validation_errors(app):
    c = make_client(app, "Ada")
    base = {"name": "Crew", "goal_title": "Laptops", "target_cents": 100_000, "deadline": (date.today() + timedelta(days=30)).isoformat(),
            "group_size": 3, "personal_target_cents": 30_000}
    assert c.post("/api/groups", json={**base, "target_cents": 100}).status_code == 422
    assert c.post("/api/groups", json={**base, "target_cents": 12.5}).status_code == 422
    assert c.post("/api/groups", json={**base, "deadline": "2020-01-01"}).status_code == 422
    assert c.post("/api/groups", json={**base, "group_size": 1}).status_code == 422
    assert c.post("/api/groups", json={**base, "personal_target_cents": 999_999_999}).status_code == 422


def test_join_rules_and_permissions(app, squad):
    code, gid = squad["code"], squad["gid"]
    cara = make_client(app, "Cara")
    assert cara.get(f"/api/groups/{gid}").status_code == 404  # non-member can't see it
    assert cara.post(f"/api/invites/{code}/join", json={"personal_target_cents": 50_000}).status_code == 422  # rules not accepted
    assert cara.post(f"/api/invites/{code}/join", json={"personal_target_cents": 50_000, "accepted_rules": True}).status_code == 201
    assert cara.post(f"/api/invites/{code}/join", json={"personal_target_cents": 50_000, "accepted_rules": True}).status_code == 409
    assert squad["ben"].patch(f"/api/groups/{gid}", json={"name": "Hijack"}).status_code == 403
    prev = cara.get(f"/api/invites/{code.lower()}").get_json()
    assert prev["already_member"] and prev["group"]["spots_left"] == 1


def test_paypal_happy_path_is_verified_and_idempotent(app, squad):
    gid, ben = squad["gid"], squad["ben"]
    o = pay(ben, gid, 25_000)
    pending = ben.get(f"/api/contributions/{o['contribution_id']}").get_json()["contribution"]
    assert pending["payment_status"] == "pending"
    assert ben.get(f"/api/groups/{gid}").get_json()["totals"]["recorded_cents"] == 0  # not counted before capture
    r = ben.post(f"/api/orders/{o['order_id']}/capture", json={})
    c = r.get_json()["contribution"]
    assert c["payment_status"] == "completed" and c["paypal_capture_id"] == f"CAP-{o['order_id']}"
    again = ben.post(f"/api/orders/{o['order_id']}/capture", json={}).get_json()
    assert again["duplicate"] is True
    assert app.extensions["paypal"].capture_calls == 1
    d = ben.get(f"/api/groups/{gid}").get_json()
    assert d["totals"]["recorded_cents"] == 25_000 and d["totals"]["percent"] == 12.5
    assert d["milestones"][0]["status"] == "upcoming"
    # another user can't capture someone else's order
    assert squad["ada"].post(f"/api/orders/{o['order_id']}/capture", json={}).status_code == 404


def test_amount_mismatch_pending_decline_and_cancel(app, squad):
    gid, ben, pp = squad["gid"], squad["ben"], app.extensions["paypal"]
    pp.capture_mode = "MISMATCH"
    o = pay(ben, gid, 10_000)
    assert ben.post(f"/api/orders/{o['order_id']}/capture", json={}).get_json()["contribution"]["payment_status"] == "failed"
    pp.capture_mode = "PENDING"
    o = pay(ben, gid, 10_000)
    c = ben.post(f"/api/orders/{o['order_id']}/capture", json={}).get_json()["contribution"]
    assert c["payment_status"] == "pending"
    pp.capture_mode = "DECLINED"
    o = pay(ben, gid, 10_000)
    assert ben.post(f"/api/orders/{o['order_id']}/capture", json={}).get_json()["contribution"]["payment_status"] == "failed"
    o = pay(ben, gid, 10_000)
    assert ben.post(f"/api/orders/{o['order_id']}/cancel", json={}).get_json()["contribution"]["payment_status"] == "cancelled"
    assert ben.get(f"/api/groups/{gid}").get_json()["totals"]["recorded_cents"] == 0


def test_order_rules(app, squad):
    gid, ben = squad["gid"], squad["ben"]
    assert ben.post(f"/api/groups/{gid}/orders", json={"amount_cents": 50}).status_code == 422
    assert ben.post(f"/api/groups/{gid}/orders", json={"amount_cents": 999_999_99}).status_code == 422
    assert ben.post(f"/api/groups/{gid}/orders", json={"amount_cents": 250_000}).status_code == 422  # more than the group needs
    ben.patch(f"/api/groups/{gid}/membership", json={"status": "paused"})
    assert ben.post(f"/api/groups/{gid}/orders", json={"amount_cents": 5_000}).status_code == 409
    app.extensions["paypal"].enabled = False
    ben.patch(f"/api/groups/{gid}/membership", json={"status": "active"})
    assert ben.post(f"/api/groups/{gid}/orders", json={"amount_cents": 5_000}).get_json()["error"]["code"] == "paypal_not_configured"


def test_refresh_resolves_pending(app, squad):
    gid, ben, pp = squad["gid"], squad["ben"], app.extensions["paypal"]
    pp.capture_mode = "PENDING"
    o = pay(ben, gid, 10_000)
    ben.post(f"/api/orders/{o['order_id']}/capture", json={})
    pp.capture_mode = "COMPLETED"
    pp.orders[o["order_id"]]["captured"] = True
    r = ben.post(f"/api/contributions/{o['contribution_id']}/refresh", json={}).get_json()["contribution"]
    assert r["payment_status"] == "completed"
    assert ben.get(f"/api/groups/{gid}").get_json()["totals"]["recorded_cents"] == 10_000


def test_target_reached_offers_and_simulated_purchase(app, squad):
    gid, ada = squad["gid"], squad["ada"]
    pre = ada.get(f"/api/groups/{gid}/offers").get_json()
    assert pre["is_preview"] and all(o["is_simulated"] for o in pre["offers"])
    assert ada.post(f"/api/groups/{gid}/purchase", json={"offer_id": 1}).status_code == 409
    for who in (ada, squad["ben"]):
        o = pay(who, gid, 100_000)
        who.post(f"/api/orders/{o['order_id']}/capture", json={})
    d = ada.get(f"/api/groups/{gid}").get_json()
    assert d["group"]["status"] == "target_reached" and d["totals"]["percent"] == 100.0
    assert all(m["status"] == "reached" for m in d["milestones"])
    offers = ada.get(f"/api/groups/{gid}/offers").get_json()
    assert not offers["is_preview"] and len(offers["offers"]) == 3
    best = max(offers["offers"], key=lambda o: o["savings_cents"])
    assert best["quoted_total_cents"] < 200_000
    assert squad["ben"].post(f"/api/groups/{gid}/purchase", json={"offer_id": best["id"]}).status_code == 403
    assert ada.post(f"/api/groups/{gid}/purchase", json={"offer_id": best["id"]}).status_code == 200
    final = ada.get(f"/api/groups/{gid}/offers").get_json()
    assert final["status"] == "purchase_simulated" and final["selected_offer"]["id"] == best["id"]
    assert ada.post(f"/api/groups/{gid}/orders", json={"amount_cents": 5_000}).status_code == 409


def test_leave_releases_contributions_and_transfers_ownership(app, squad):
    gid, ada, ben = squad["gid"], squad["ada"], squad["ben"]
    o = pay(ada, gid, 30_000)
    ada.post(f"/api/orders/{o['order_id']}/capture", json={})
    assert ben.get(f"/api/groups/{gid}").get_json()["totals"]["recorded_cents"] == 30_000
    assert ada.post(f"/api/groups/{gid}/leave", json={}).status_code == 200
    d = ben.get(f"/api/groups/{gid}").get_json()
    assert d["totals"]["recorded_cents"] == 0 and d["group"]["owner_id"] == d["me"]["user_id"]
    assert ada.get(f"/api/groups/{gid}").status_code == 404
    with app.app_context():
        assert Contribution.query.filter_by(payment_status="released").count() == 1


def test_fair_edits_and_milestones(app, squad):
    gid, ada = squad["gid"], squad["ada"]
    assert ada.patch(f"/api/groups/{gid}", json={"target_cents": 300_000}).status_code == 422  # can't raise after others join
    assert ada.patch(f"/api/groups/{gid}", json={"deadline": (date.today() + timedelta(days=10)).isoformat()}).status_code == 422
    r = ada.patch(f"/api/groups/{gid}", json={"target_cents": 160_000, "deadline": (date.today() + timedelta(days=90)).isoformat()})
    assert r.status_code == 200 and r.get_json()["milestones"][-1]["target_cents"] == 160_000
    bad = ada.put(f"/api/groups/{gid}/milestones", json={"milestones": [{"title": "Half", "percent": 50}, {"title": "Mid", "percent": 40}]})
    assert bad.status_code == 422
    ok = ada.put(f"/api/groups/{gid}/milestones", json={"milestones": [{"title": "Laptop one", "percent": 30}, {"title": "All in", "percent": 100}]})
    assert ok.status_code == 200 and len(ok.get_json()["milestones"]) == 2


def test_ai_fallbacks_without_key(app, squad):
    gid, ben = squad["gid"], squad["ben"]
    m = ben.post(f"/api/groups/{gid}/ai/milestones", json={}).get_json()
    assert m["source"] == "fallback" and m["milestones"][-1]["percent"] == 100 and m["milestones"][-1]["target_cents"] == 200_000
    c = ben.post(f"/api/groups/{gid}/ai/coach", json={}).get_json()
    assert c["source"] == "fallback" and c["recommendations"]
    u = ben.post(f"/api/groups/{gid}/ai/update", json={}).get_json()
    assert "4 laptops" in u["body"]
    r = ben.post(f"/api/groups/{gid}/ai/reminder", json={"audience": "group"}).get_json()
    assert "pause" in r["body"]
    assert ben.post(f"/api/groups/{gid}/ai/reminder", json={"audience": "nobody"}).status_code == 422
    assert make_client(app, "Zed").post(f"/api/groups/{gid}/ai/coach", json={}).status_code == 404


def test_ai_output_is_validated(app, squad, monkeypatch):
    from app.services import llm

    gid, ben = squad["gid"], squad["ben"]
    app.config["ANTHROPIC_API_KEY"] = "test"
    good = '{"milestones":[{"title":"First laptop","percent":30,"note":"Nice start."},{"title":"Almost there","percent":70},{"title":"All in","percent":100}],"rationale":"Three steady checkpoints."}'
    monkeypatch.setattr(llm, "call_llm", lambda *a, **k: "Sure!\n```json\n" + good + "\n```")
    m = ben.post(f"/api/groups/{gid}/ai/milestones", json={}).get_json()
    assert m["source"] == "ai" and [x["percent"] for x in m["milestones"]] == [30, 70, 100]
    assert m["milestones"][0]["target_cents"] == 60_000  # backend arithmetic, not the model's
    monkeypatch.setattr(llm, "call_llm", lambda *a, **k: '{"milestones":[{"title":"Bad","percent":80},{"title":"Worse","percent":40}],"rationale":"nope nope"}')
    m = ben.post(f"/api/groups/{gid}/ai/milestones", json={}).get_json()
    assert m["source"] == "fallback" and "expected shape" in m["fallback_reason"]
    monkeypatch.setattr(llm, "call_llm", lambda *a, **k: '{"summary":"You are doing fine, truly.","recommendations":[{"action":"extend_deadline","message":"Extend it please."}]}')
    c = ben.post(f"/api/groups/{gid}/ai/coach", json={}).get_json()
    assert c["source"] == "fallback"  # action wasn't among the available options


def test_seeded_demo_and_spa_fallbacks(app):
    from app.services.seed import seed_demo

    with app.app_context():
        seed_demo()
    c = app.test_client()
    demo = c.get("/api/demo").get_json()["group"]
    assert demo["invite_code"] == "DEMO-SQUAD" and 20 < demo["percent"] < 40 and demo["members"] == 4
    assert c.get("/api/config").get_json()["paypal"]["client_id"] == "test-client-id"
    assert c.get("/api/nope").status_code == 404
    assert c.get("/some/page").status_code in (200, 503)
    joiner = make_client(app, "Judge")
    r = joiner.post("/api/invites/DEMO-SQUAD/join", json={"personal_target_cents": 60_000, "accepted_rules": True})
    gid = r.get_json()["group_id"]
    d = joiner.get(f"/api/groups/{gid}").get_json()
    assert any(m["pace"] == "catching_up" for m in d["members"]) and d["milestones"][0]["status"] == "reached"
