import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from collections import defaultdict, deque
from contextlib import contextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.matching import extract_skills, match, normalize

class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class Credentials(Input):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def email_format(cls, value):
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Invalid email")
        return value.casefold()

class Registration(Credentials):
    role: Literal["candidate", "employer"]
    locale: Literal["ar", "en", "fr"] = "en"

class Company(Input):
    name: str = Field(min_length=2, max_length=160)

class Skills(Input):
    skills: list[str] = Field(max_length=100)

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, values):
        if any(not s.strip() or len(s) > 80 for s in values):
            raise ValueError("Skills must contain 1–80 characters")
        return sorted({normalize(s) for s in values})

class Job(Skills):
    company_id: str = Field(max_length=64)
    title: str = Field(min_length=2, max_length=180)
    description: str = Field(min_length=20, max_length=20000)
    country: str = Field(pattern=r"^[A-Z]{2}$")
    locale: Literal["ar", "en", "fr"] = "en"
    remote: bool = False

class CV(Input):
    text: str = Field(min_length=20, max_length=50000)
    consent: Literal[True]

class Status(Input):
    status: Literal["reviewing", "interview", "offered", "rejected", "withdrawn"]

class Message(Input):
    body: str = Field(min_length=1, max_length=4000)

def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f"{salt}:{digest}"

def create_app(db_path=None):
    if os.getenv("APP_ENV") == "production":
        raise RuntimeError("Production is gated: complete SECURITY.md and obtain owner approval.")
    db_path = str(db_path or os.getenv("DATABASE_PATH", "talent.db"))

    @contextmanager
    def db():
        con = sqlite3.connect(db_path, timeout=10)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys=ON")
        try:
            with con:
                yield con
        finally:
            con.close()

    with db() as con:
        con.executescript(Path(__file__).with_name("schema.sql").read_text())
    app = FastAPI(title="Talent Atlas — independent recruitment API", version="0.1.0")
    bearer = HTTPBearer(auto_error=False)
    attempts = defaultdict(deque)
    lock = threading.Lock()

    @app.middleware("http")
    async def protections(request: Request, call_next):
        # Single-process staging guard. Distributed limiter required before scaling.
        if request.url.path.startswith("/auth/"):
            key = request.client.host if request.client else "unknown"
            now = time.monotonic()
            with lock:
                for old in list(attempts):
                    while attempts[old] and attempts[old][0] < now - 60:
                        attempts[old].popleft()
                    if not attempts[old]:
                        del attempts[old]
                queue = attempts[key]
                if len(queue) >= 20 or len(attempts) > 10000:
                    return JSONResponse({"detail": "rate_limited"}, status_code=429, headers={"Retry-After": "60"})
                queue.append(now)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    def user(auth: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if not auth:
            raise HTTPException(401, "authentication_required")
        digest = hashlib.sha256(auth.credentials.encode()).hexdigest()
        with db() as con:
            row = con.execute("SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.digest=? AND s.expires>?", (digest, int(time.time()))).fetchone()
        if not row:
            raise HTTPException(401, "invalid_session")
        return dict(row)

    def require_role(who, role):
        if who["role"] != role:
            raise HTTPException(403, "role_forbidden")

    def notification(con, user_id, event, reference):
        con.execute("INSERT INTO notifications VALUES (?,?,?,?,?)", (secrets.token_hex(16), user_id, event, reference, int(time.time())))

    def application(con, app_id, who):
        row = con.execute("SELECT a.*, c.owner_id FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE a.id=?", (app_id,)).fetchone()
        if not row or who["id"] not in (row["candidate_id"], row["owner_id"]):
            raise HTTPException(404, "application_not_found")
        return row

    @app.get("/health")
    def health():
        with db() as con:
            con.execute("SELECT 1").fetchone()
        return {"status": "ok", "stage": "development", "production_ready": False}

    @app.post("/auth/register", status_code=201)
    def register(data: Registration):
        uid = secrets.token_hex(16)
        try:
            with db() as con:
                con.execute("INSERT INTO users VALUES (?,?,?,?,?)", (uid, data.email, password_hash(data.password), data.role, data.locale))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "account_unavailable")
        return {"id": uid, "role": data.role, "locale": data.locale}

    @app.post("/auth/login")
    def login(data: Credentials):
        with db() as con:
            row = con.execute("SELECT * FROM users WHERE email=?", (data.email,)).fetchone()
            stored = row["password"] if row else "00" * 16 + ":" + "00" * 64
            computed = password_hash(data.password, stored.split(":")[0])
            if not hmac.compare_digest(computed, stored):
                raise HTTPException(401, "invalid_credentials")
            token = secrets.token_urlsafe(32)
            con.execute("DELETE FROM sessions WHERE expires<=?", (int(time.time()),))
            con.execute("INSERT INTO sessions VALUES (?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), row["id"], int(time.time()) + 3600))
        return {"access_token": token, "token_type": "bearer", "expires_in": 3600}

    @app.post("/auth/logout", status_code=204)
    def logout(who=Depends(user), auth=Depends(bearer)):
        with db() as con:
            con.execute("DELETE FROM sessions WHERE digest=?", (hashlib.sha256(auth.credentials.encode()).hexdigest(),))

    @app.get("/me")
    def me(who=Depends(user)):
        return {k: who[k] for k in ("id", "email", "role", "locale")}

    @app.put("/me/profile")
    def profile(data: Skills, who=Depends(user)):
        require_role(who, "candidate")
        with db() as con:
            con.execute("INSERT INTO profiles VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET skills=excluded.skills", (who["id"], json.dumps(data.skills)))
        return data

    @app.post("/me/cv/analyze")
    def cv(data: CV, who=Depends(user)):
        require_role(who, "candidate")
        return {"skills": extract_skills(data.text), "method": "dictionary-v1", "stored": False,
                "requires_confirmation": True, "limitations": ["Text only", "Limited vocabulary", "No AI provider connected"]}

    @app.post("/companies", status_code=201)
    def company(data: Company, who=Depends(user)):
        require_role(who, "employer")
        cid = secrets.token_hex(16)
        with db() as con:
            con.execute("INSERT INTO companies VALUES (?,?,?)", (cid, who["id"], data.name))
        return {"id": cid, "name": data.name}

    @app.post("/jobs", status_code=201)
    def create_job(data: Job, who=Depends(user)):
        require_role(who, "employer")
        jid = secrets.token_hex(16)
        with db() as con:
            if not con.execute("SELECT 1 FROM companies WHERE id=? AND owner_id=?", (data.company_id, who["id"])).fetchone():
                raise HTTPException(404, "company_not_found")
            con.execute("INSERT INTO jobs(id,company_id,title,description,country,locale,skills,remote) VALUES (?,?,?,?,?,?,?,?)", (jid, data.company_id, data.title, data.description, data.country, data.locale, json.dumps(data.skills), data.remote))
        return {"id": jid, **data.model_dump(), "status": "open"}

    @app.get("/jobs")
    def jobs(q: str = Query("", max_length=180), country: str | None = Query(None, pattern=r"^[A-Z]{2}$"), remote: bool | None = None, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0, le=10000)):
        conditions, args = ["status='open'"], []
        if q:
            conditions.append("(instr(lower(title), lower(?))>0 OR instr(lower(description), lower(?))>0)")
            args += [q, q]
        if country:
            conditions.append("country=?")
            args.append(country)
        if remote is not None:
            conditions.append("remote=?")
            args.append(int(remote))
        with db() as con:
            rows = con.execute("SELECT * FROM jobs WHERE " + " AND ".join(conditions) + " ORDER BY id LIMIT ? OFFSET ?", (*args, limit, offset)).fetchall()
        return [{**dict(r), "skills": json.loads(r["skills"]), "remote": bool(r["remote"])} for r in rows]

    @app.post("/jobs/{job_id}/close")
    def close(job_id: str, who=Depends(user)):
        with db() as con:
            result = con.execute("UPDATE jobs SET status='closed' WHERE id=? AND company_id IN (SELECT id FROM companies WHERE owner_id=?)", (job_id, who["id"]))
            if not result.rowcount:
                raise HTTPException(404, "job_not_found")
        return {"status": "closed"}

    @app.get("/jobs/{job_id}/match")
    def matching(job_id: str, who=Depends(user)):
        require_role(who, "candidate")
        with db() as con:
            row = con.execute("SELECT skills FROM jobs WHERE id=? AND status='open'", (job_id,)).fetchone()
            p = con.execute("SELECT skills FROM profiles WHERE user_id=?", (who["id"],)).fetchone()
        if not row:
            raise HTTPException(404, "job_not_found")
        return match(json.loads(p["skills"]) if p else [], json.loads(row["skills"]))

    @app.post("/jobs/{job_id}/applications", status_code=201)
    def apply(job_id: str, who=Depends(user)):
        require_role(who, "candidate")
        aid = secrets.token_hex(16)
        try:
            with db() as con:
                con.execute("BEGIN IMMEDIATE")
                row = con.execute("SELECT c.owner_id FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.id=? AND j.status='open'", (job_id,)).fetchone()
                if not row:
                    raise HTTPException(404, "job_not_found")
                con.execute("INSERT INTO applications(id,job_id,candidate_id) VALUES (?,?,?)", (aid, job_id, who["id"]))
                notification(con, row["owner_id"], "application.submitted", aid)
        except sqlite3.IntegrityError:
            raise HTTPException(409, "already_applied")
        return {"id": aid, "status": "submitted"}

    @app.get("/applications")
    def applications(who=Depends(user), limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
        with db() as con:
            rows = con.execute("SELECT a.* FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE a.candidate_id=? OR c.owner_id=? ORDER BY a.id LIMIT ? OFFSET ?", (who["id"], who["id"], limit, offset)).fetchall()
        return [dict(r) for r in rows]

    @app.patch("/applications/{app_id}")
    def change_status(app_id: str, data: Status, who=Depends(user)):
        with db() as con:
            con.execute("BEGIN IMMEDIATE")
            row = application(con, app_id, who)
            allowed = {"submitted": {"reviewing", "rejected"}, "reviewing": {"interview", "rejected"}, "interview": {"offered", "rejected"}}
            if who["id"] == row["candidate_id"]:
                valid = data.status == "withdrawn" and row["status"] not in ("withdrawn", "rejected")
                recipient = row["owner_id"]
            else:
                valid = data.status in allowed.get(row["status"], set())
                recipient = row["candidate_id"]
            if not valid:
                raise HTTPException(409, "invalid_transition")
            con.execute("UPDATE applications SET status=? WHERE id=?", (data.status, app_id))
            notification(con, recipient, "application." + data.status, app_id)
        return {"id": app_id, "status": data.status}

    @app.post("/applications/{app_id}/messages", status_code=201)
    def send_message(app_id: str, data: Message, who=Depends(user)):
        mid = secrets.token_hex(16)
        with db() as con:
            row = application(con, app_id, who)
            if row["status"] in ("rejected", "withdrawn"):
                raise HTTPException(409, "conversation_closed")
            con.execute("INSERT INTO messages VALUES (?,?,?,?,?)", (mid, app_id, who["id"], data.body, int(time.time())))
            recipient = row["owner_id"] if who["id"] == row["candidate_id"] else row["candidate_id"]
            notification(con, recipient, "message.created", app_id)
        return {"id": mid}

    @app.get("/applications/{app_id}/messages")
    def messages(app_id: str, who=Depends(user), limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
        with db() as con:
            application(con, app_id, who)
            rows = con.execute("SELECT * FROM messages WHERE application_id=? ORDER BY created,id LIMIT ? OFFSET ?", (app_id, limit, offset)).fetchall()
        return [dict(r) for r in rows]

    @app.get("/me/notifications")
    def notifications(who=Depends(user), limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
        with db() as con:
            rows = con.execute("SELECT * FROM notifications WHERE user_id=? ORDER BY created DESC,id LIMIT ? OFFSET ?", (who["id"], limit, offset)).fetchall()
        return [dict(r) for r in rows]

    return app
