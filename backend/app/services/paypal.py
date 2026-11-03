"""Minimal PayPal REST v2 client. Sandbox only: the base URL is fixed on purpose."""
import logging
import threading
import time

import requests

from ..money import paypal_value

log = logging.getLogger("squadfund.paypal")

SANDBOX_BASE = "https://api-m.sandbox.paypal.com"


class PayPalError(Exception):
    def __init__(self, message, code=None, status=None, details=None):
        super().__init__(message)
        self.code, self.status, self.details = code, status, details or []

    @property
    def issues(self):
        return {d.get("issue") for d in self.details if isinstance(d, dict)}


class PayPalClient:
    def __init__(self, client_id, client_secret):
        self.client_id, self.client_secret = client_id, client_secret
        self._token, self._expires, self._lock = None, 0.0, threading.Lock()

    @property
    def enabled(self):
        return bool(self.client_id and self.client_secret)

    def _access_token(self):
        with self._lock:
            if self._token and time.time() < self._expires - 60:
                return self._token
            try:
                r = requests.post(f"{SANDBOX_BASE}/v1/oauth2/token", auth=(self.client_id, self.client_secret),
                                  data={"grant_type": "client_credentials"}, timeout=20)
            except requests.RequestException as e:
                raise PayPalError("Could not reach PayPal.", code="network") from e
            if r.status_code != 200:
                log.error("PayPal token request failed: %s", r.status_code)
                raise PayPalError("PayPal rejected the Sandbox credentials.", code="auth", status=r.status_code)
            body = r.json()
            self._token = body["access_token"]
            self._expires = time.time() + int(body.get("expires_in", 300))
            return self._token

    def _call(self, method, path, json=None, headers=None):
        h = {"Authorization": f"Bearer {self._access_token()}", "Content-Type": "application/json", "Prefer": "return=representation"}
        h.update(headers or {})
        try:
            r = requests.request(method, f"{SANDBOX_BASE}{path}", json=json, headers=h, timeout=25)
        except requests.RequestException as e:
            raise PayPalError("Could not reach PayPal.", code="network") from e
        try:
            body = r.json() if r.content else {}
        except ValueError:
            body = {}
        if r.status_code >= 400:
            log.warning("PayPal %s %s -> %s %s", method, path, r.status_code, body.get("name"))
            raise PayPalError(body.get("message", "PayPal returned an error."), code=body.get("name"), status=r.status_code, details=body.get("details"))
        return body

    def create_order(self, amount_cents, currency, reference_id, custom_id, description, request_id):
        return self._call("POST", "/v2/checkout/orders", headers={"PayPal-Request-Id": request_id}, json={
            "intent": "CAPTURE",
            "purchase_units": [{
                "reference_id": reference_id,
                "custom_id": custom_id,
                "description": description[:120],
                "amount": {"currency_code": currency, "value": paypal_value(amount_cents)},
            }],
            "application_context": {"brand_name": "SquadFund (Sandbox demo)", "shipping_preference": "NO_SHIPPING", "user_action": "PAY_NOW"},
        })

    def capture_order(self, order_id, request_id):
        return self._call("POST", f"/v2/checkout/orders/{order_id}/capture", headers={"PayPal-Request-Id": request_id}, json={})

    def get_order(self, order_id):
        return self._call("GET", f"/v2/checkout/orders/{order_id}")
