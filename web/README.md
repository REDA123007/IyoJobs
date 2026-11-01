# IyoJobs web (Stage 3 foundation)

React 19 + TypeScript + Vite. Seven UI languages (ar, en, fr, ru, de, it, es), real RTL for Arabic, WCAG-checked colour tokens sampled from the logo.

```bash
npm ci
npm run dev        # proxies /api -> http://127.0.0.1:8000 (strips the /api prefix)
npm test           # unit, component, axe, and a contract test against the REAL Python API
npm run build
```

The contract test starts `uvicorn app.main:create_app` from the repo root. Python 3.12+ with `requirements-dev.lock` installed is required; choose the interpreter with `IYOJOBS_PYTHON`.

## What works today
Home page and job search (keyword, country, remote/on-site, paging) against the real API, all 7 languages, every ISO country plus Kosovo with names in the UI language.

## Not built (the API does not offer it yet — see docs/STATUS.md)
Accounts/session UI, saved jobs, alerts, recovery, job detail page, employer workspace. They are not mocked in the UI.

## Rules followed
No tokens or personal data in `localStorage` (only the language choice). Logical CSS properties only. Logo is never stretched. Translations are drafts that need native-speaker review.
