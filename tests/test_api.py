import hashlib
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.matching import extract_skills, match

@pytest.fixture
def setup(tmp_path):
    path = tmp_path / "test.db"
    client = TestClient(create_app(path))
    def account(name, role):
        data = {"email": f"{name}@example.com", "password": "correct-horse-2026", "role": role, "locale": "ar"}
        assert client.post("/auth/register", json=data).status_code == 201
        response = client.post("/auth/login", json={k: data[k] for k in ("email", "password")})
        return {"Authorization": "Bearer " + response.json()["access_token"]}
    candidate = account("candidate", "candidate")
    employer = account("employer", "employer")
    outsider = account("outsider", "employer")
    other = account("other", "candidate")
    company = client.post("/companies", headers=employer, json={"name": "Example"}).json()["id"]
    payload = {"company_id": company, "title": "مهندس Python", "description": "Build reliable services with Python and SQL", "country": "MA", "locale": "ar", "skills": ["python", "sql"], "remote": True}
    job = client.post("/jobs", headers=employer, json=payload).json()["id"]
    return client, candidate, employer, outsider, other, job, payload, path

def test_end_to_end(setup):
    c, candidate, employer, _, _, job, _, _ = setup
    analysis = c.post("/me/cv/analyze", headers=candidate, json={"text": "لدي خبرة في بايثون و SQL منذ سنوات", "consent": True})
    assert analysis.json()["skills"] == ["python", "sql"]
    assert c.put("/me/profile", headers=candidate, json={"skills": analysis.json()["skills"]}).status_code == 200
    assert c.get(f"/jobs/{job}/match", headers=candidate).json()["score"] == 100
    assert len(c.get("/jobs", params={"q": "مهندس", "country": "MA", "remote": True}).json()) == 1
    app = c.post(f"/jobs/{job}/applications", headers=candidate)
    assert app.status_code == 201
    aid = app.json()["id"]
    assert c.patch(f"/applications/{aid}", headers=employer, json={"status": "reviewing"}).status_code == 200
    assert c.post(f"/applications/{aid}/messages", headers=employer, json={"body": "Invitation to discuss the role"}).status_code == 201
    assert len(c.get(f"/applications/{aid}/messages", headers=candidate).json()) == 1
    assert len(c.get("/me/notifications", headers=candidate).json()) == 2
    assert c.get("/applications", headers=candidate).json()[0]["status"] == "reviewing"

def test_tenant_isolation(setup):
    c, candidate, employer, outsider, other, job, payload, _ = setup
    assert c.post("/jobs", headers=outsider, json=payload).status_code == 404
    assert c.post("/jobs", headers=candidate, json=payload).status_code == 403
    aid = c.post(f"/jobs/{job}/applications", headers=candidate).json()["id"]
    for headers in (outsider, other):
        assert c.get(f"/applications/{aid}/messages", headers=headers).status_code == 404
        assert c.post(f"/applications/{aid}/messages", headers=headers, json={"body": "attack"}).status_code == 404
        assert c.patch(f"/applications/{aid}", headers=headers, json={"status": "reviewing"}).status_code == 404
        assert c.get("/applications", headers=headers).json() == []
        assert c.get("/me/notifications", headers=headers).json() == []
    assert c.post(f"/jobs/{job}/close", headers=outsider).status_code == 404

def test_duplicate_and_state_machine(setup):
    c, candidate, employer, _, _, job, _, _ = setup
    aid = c.post(f"/jobs/{job}/applications", headers=candidate).json()["id"]
    assert c.post(f"/jobs/{job}/applications", headers=candidate).status_code == 409
    assert c.patch(f"/applications/{aid}", headers=employer, json={"status": "offered"}).status_code == 409
    assert c.patch(f"/applications/{aid}", headers=candidate, json={"status": "offered"}).status_code == 409
    assert c.patch(f"/applications/{aid}", headers=candidate, json={"status": "withdrawn"}).status_code == 200
    assert c.post(f"/applications/{aid}/messages", headers=employer, json={"body": "closed"}).status_code == 409
    assert c.patch(f"/applications/{aid}", headers=employer, json={"status": "reviewing"}).status_code == 409

def test_close_and_roles(setup):
    c, candidate, employer, _, other, job, _, _ = setup
    assert c.post(f"/jobs/{job}/applications", headers=employer).status_code == 403
    assert c.post(f"/jobs/{job}/close", headers=employer).status_code == 200
    assert c.post(f"/jobs/{job}/applications", headers=other).status_code == 404
    assert c.get("/jobs").json() == []
    assert c.post("/companies", headers=candidate, json={"name": "fake"}).status_code == 403

def test_auth_session_and_storage(setup):
    c, candidate, _, _, _, _, _, path = setup
    assert c.get("/me").status_code == 401
    assert c.get("/me", headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert c.post("/auth/login", json={"email": "candidate@example.com", "password": "wrong-password-123"}).status_code == 401
    token = candidate["Authorization"].split()[1]
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT password FROM users LIMIT 1").fetchone()[0] != "correct-horse-2026"
        assert db.execute("SELECT count(*) FROM sessions WHERE digest=?", (token,)).fetchone()[0] == 0
        assert db.execute("SELECT count(*) FROM sessions WHERE digest=?", (hashlib.sha256(token.encode()).hexdigest(),)).fetchone()[0] == 1
    assert "password" not in c.get("/me", headers=candidate).json()
    assert c.post("/auth/logout", headers=candidate).status_code == 204
    assert c.get("/me", headers=candidate).status_code == 401

def test_expiry_and_persistence(setup):
    c, candidate, _, _, _, _, _, path = setup
    fresh = TestClient(create_app(path))
    assert len(fresh.get("/jobs").json()) == 1
    with sqlite3.connect(path) as db:
        db.execute("UPDATE sessions SET expires=0")
    assert fresh.get("/me", headers=candidate).status_code == 401

def test_validation_and_injection(setup):
    c, candidate, employer, _, _, _, payload, _ = setup
    assert c.get("/jobs", params={"q": "' OR 1=1 --"}).json() == []
    assert c.get("/jobs?limit=1000").status_code == 422
    assert c.post("/jobs", headers=employer, json={**payload, "skills": [""]}).status_code == 422
    assert c.post("/me/cv/analyze", headers=candidate, json={"text": "x" * 30, "consent": False}).status_code == 422
    assert c.post("/me/cv/analyze", headers=candidate, json={"text": "x" * 50001, "consent": True}).status_code == 422
    assert c.put("/me/profile", headers=candidate, json={"skills": [], "user_id": "someone-else"}).status_code == 422

def test_rate_limit(tmp_path):
    c = TestClient(create_app(tmp_path / "rate.db"))
    statuses = [c.post("/auth/login", json={"email": "nobody@example.com", "password": "some-password-123"}).status_code for _ in range(21)]
    assert statuses[-1] == 429

def test_no_automatic_ai_decision():
    assert match([], [])["score"] is None
    assert match(["Python"], ["python", "sql"])["score"] == 50
    assert extract_skills("javascript is different from java") == ["java", "javascript"]
    assert extract_skills("javascript") == ["javascript"]

def test_production_gate(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(RuntimeError, match="Production is gated"):
        create_app(tmp_path / "production.db")
