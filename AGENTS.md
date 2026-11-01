# Implementation contract

- Independent implementation. Never copy JobOps code, schemas, prompts, branding or assets.
- Read docs/SPEC.ar.md, docs/ARCHITECTURE.md and SECURITY.md before changes.
- Work in small tested vertical slices; update docs/STATUS.md with evidence.
- Never claim dictionary matching is AI, internal notifications are FCM, or a build passed without execution.
- Run `python -m pytest -q` and dependency audit after dependency changes.
- Enforce resource ownership server-side. Add a negative authorization test for each private resource.
- No sensitive data in logs, commits or notification payloads. No production personal data in tests.
- Never deploy production, publish an Android release, or enable a production pipeline without explicit owner approval.
- Preserve private GitHub visibility. No scraping provider without documented rights.
