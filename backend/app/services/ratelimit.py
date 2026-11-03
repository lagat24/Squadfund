import threading
import time
from collections import defaultdict, deque

_hits = defaultdict(deque)
_lock = threading.Lock()


def allow(key, limit, window_seconds=3600):
    """Small in-process limiter for AI calls. Use a shared store if you run many instances."""
    now = time.time()
    with _lock:
        q = _hits[key]
        while q and q[0] < now - window_seconds:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        return True
