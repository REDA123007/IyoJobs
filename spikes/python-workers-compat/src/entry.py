from workers import WorkerEntrypoint, Response
import hashlib, time

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        out = {}
        try:
            t = time.time()
            hashlib.scrypt(b"pw", salt=b"s" * 16, n=16384, r=8, p=1, dklen=64)
            out["scrypt_n16384_ms"] = round((time.time() - t) * 1000)
        except Exception as e:
            out["scrypt"] = repr(e)
        try:
            t = time.time()
            hashlib.pbkdf2_hmac("sha256", b"pw", b"s" * 16, 100000)
            out["pbkdf2_100k_ms"] = round((time.time() - t) * 1000)
        except Exception as e:
            out["pbkdf2"] = repr(e)
        try:
            import sqlite3
            c = sqlite3.connect(":memory:")
            out["sqlite3"] = c.execute("select sqlite_version()").fetchone()[0]
        except Exception as e:
            out["sqlite3"] = repr(e)
        try:
            import threading
            lock = threading.Lock()
            with lock:
                out["threading_lock"] = "ok (single isolate, no real threads)"
        except Exception as e:
            out["threading_lock"] = repr(e)
        return Response.json(out)
