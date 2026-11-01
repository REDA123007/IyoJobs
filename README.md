# IyoJobs

Independent multilingual recruitment platform — stage 0/1 deliverable. GitHub destination authorized by owner: `REDA123007/IyoJobs` (private). Local package name remains `talent-atlas`.

This is a working API milestone, not the completed global platform. It includes persistent accounts, company-owned jobs, search, applications, state transitions, private applicant conversations and notification inboxes. CV text analysis and matching use an explicitly labeled local baseline. Android, FCM, model-backed AI, employer UI and production hardening are planned, not claimed implemented.

## Run locally

Use Python 3.12+ (tested environment 3.13). From this directory:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.lock
.venv/Scripts/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for the interactive API. Register candidate and employer separately; log each in; use the returned bearer token with Authorize. Employer creates company then job. Candidate confirms skills using `/me/profile`, searches, views match and applies. Employer changes status and sends a message; candidate reads notifications and conversation. Use synthetic data only.

```powershell
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m pip_audit -r requirements.lock
docker compose up --build
```

SQLite defaults to `talent.db`; set `DATABASE_PATH` for a different location whose parent directory exists. Do not commit the database. Docker stores it in a named volume. Runtime is intentionally development-only; `APP_ENV=production` fails closed pending security work and owner approval.

## Documentation

- [Arabic specification](docs/SPEC.ar.md)
- [Repository/legal review](docs/REPOSITORY-REVIEW.ar.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database and ER diagram](docs/DATABASE.md)
- [MVP milestones and backlog](docs/MVP-PLAN.ar.md)
- [Security review](SECURITY.md)
- [Actual verification status](docs/STATUS.md)
- [Codex implementation rules](AGENTS.md)

No JobOps source, schema, prompts or assets were copied into this project. Source remains private pending the owner's licensing decision. Dependency licenses are separate; review their inventory before distribution. No production deployment has been authorized or performed.
