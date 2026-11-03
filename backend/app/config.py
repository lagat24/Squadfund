import os
import secrets


def _flag(name, default):
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")


def database_url():
    url = os.environ.get("DATABASE_URL", "").strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


def load_config():
    secret = os.environ.get("SECRET_KEY", "").strip()
    production = os.environ.get("APP_ENV", "development").strip().lower() == "production"
    return {
        "SECRET_KEY": secret or secrets.token_hex(32),
        "SECRET_KEY_IS_EPHEMERAL": not secret,
        "SQLALCHEMY_DATABASE_URI": database_url(),
        "SQLALCHEMY_ENGINE_OPTIONS": {"pool_pre_ping": True},
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SAMESITE": "Lax",
        "SESSION_COOKIE_SECURE": production,
        "PERMANENT_SESSION_LIFETIME": 60 * 60 * 24 * 30,
        "JSON_SORT_KEYS": False,
        "MAX_CONTENT_LENGTH": 64 * 1024,
        "CURRENCY": os.environ.get("DEFAULT_CURRENCY", "USD").strip().upper() or "USD",
        "PAYPAL_CLIENT_ID": os.environ.get("PAYPAL_CLIENT_ID", "").strip(),
        "PAYPAL_CLIENT_SECRET": os.environ.get("PAYPAL_CLIENT_SECRET", "").strip(),
        "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", "").strip(),
        "ANTHROPIC_MODEL": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5").strip(),
        "SEED_DEMO_DATA": _flag("SEED_DEMO_DATA", "true"),
        "AI_CALLS_PER_HOUR": int(os.environ.get("AI_CALLS_PER_HOUR", "40")),
    }
