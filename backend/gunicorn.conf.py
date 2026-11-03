import os

# Render injects PORT. Nothing here is tied to a machine or a path.
bind = "0.0.0.0:" + os.environ.get("PORT", "10000")
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
threads = 4
timeout = 60
preload_app = True  # create tables and seed once, before workers fork
accesslog = "-"
