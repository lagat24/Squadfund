def register_routes(app):
    from . import ai, auth, contributions, groups, offers, public

    for module in (public, auth, groups, contributions, offers, ai):
        app.register_blueprint(module.bp)
