"""Thin Anthropic Messages client plus strict JSON validation."""
import json
import logging

import requests
from flask import current_app

log = logging.getLogger("squadfund.ai")

API_URL = "https://api.anthropic.com/v1/messages"


class AIUnavailable(Exception):
    """Raised for any reason the model can't give a usable answer. Callers fall back."""

    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


def configured():
    return bool(current_app.config.get("ANTHROPIC_API_KEY"))


def call_llm(system, prompt, max_tokens=900):
    key = current_app.config.get("ANTHROPIC_API_KEY")
    if not key:
        raise AIUnavailable("AI key not configured")
    try:
        r = requests.post(
            API_URL,
            headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": current_app.config["ANTHROPIC_MODEL"], "max_tokens": max_tokens, "system": system,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=40,
        )
    except requests.RequestException:
        raise AIUnavailable("AI service unreachable")
    if r.status_code != 200:
        log.warning("AI request failed with status %s", r.status_code)
        raise AIUnavailable(f"AI service returned {r.status_code}")
    try:
        blocks = r.json().get("content", [])
    except ValueError:
        raise AIUnavailable("AI response was not readable")
    return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")


def extract_json(text):
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise AIUnavailable("AI response had no JSON")
    try:
        return json.loads(text[start:end + 1])
    except ValueError:
        raise AIUnavailable("AI response was not valid JSON")


def ask(model_cls, system, prompt, max_tokens=900):
    """Call the model and validate the structured output. Raises AIUnavailable on any problem."""
    from pydantic import ValidationError

    data = extract_json(call_llm(system, prompt, max_tokens))
    try:
        return model_cls.model_validate(data)
    except ValidationError:
        log.warning("AI output failed validation for %s", model_cls.__name__)
        raise AIUnavailable("AI output did not match the expected shape")
