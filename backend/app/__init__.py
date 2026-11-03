import logging
from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from werkzeug.security import safe_join

from .config import load_config
from .errors import ApiError, register_error_handlers
from .extensions import db
from .services.paypal import PayPalClient

log = logging.getLogger("squadfund")


def create_app(overrides=None):
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass

    app = Flask(__name__, static_folder=None)
    app.config.update(load_config())
    app.config.update(overrides or {})
    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError("DATABASE_URL is not set. Add your PostgreSQL connection string to the environment (see .env.example).")
    if app.config["SECRET_KEY_IS_EPHEMERAL"] and not app.testing:
        log.warning("SECRET_KEY is not set; sessions will reset whenever the server restarts.")

    db.init_app(app)
    app.extensions["paypal"] = PayPalClient(app.config["PAYPAL_CLIENT_ID"], app.config["PAYPAL_CLIENT_SECRET"])
    register_error_handlers(app)

    from .routes import register_routes

    register_routes(app)

    with app.app_context():
        try:
            db.create_all()
        except Exception:  # another worker may have created the tables first
            log.exception("create_all raised; continuing")
            db.session.rollback()
        if app.config["SEED_DEMO_DATA"]:
            from .services.seed import seed_demo

            try:
                seed_demo()
            except Exception:
                log.exception("Seeding demo data failed")
                db.session.rollback()

    @app.cli.command("seed-demo")
    def seed_command():
        from .services.seed import seed_demo

        seed_demo()
        print("Demo group is available (invite code DEMO-SQUAD).")

    dist = Path(app.root_path).parent / "static"

    @app.after_request
    def _headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "same-origin")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        return resp

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def spa(path):
        if path.startswith("api/") or path == "api":
            raise ApiError(404, "not_found", "Not found.")
        target = safe_join(str(dist), path) if path else None
        if target and Path(target).is_file():
            resp = send_from_directory(dist, path)
            if path.startswith("assets/"):
                resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return resp
        index = dist / "index.html"
        if index.is_file():
            resp = send_from_directory(dist, "index.html")
            resp.headers["Cache-Control"] = "no-cache"
            return resp
        return jsonify(message="The client build was not found. Run the frontend build (see README)."), 503

    return app
