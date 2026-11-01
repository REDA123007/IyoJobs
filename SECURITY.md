# Security review and production gate

Stage 1 is for local development with synthetic data. It is not approved for public production. `APP_ENV=production` refuses startup. No deployment workflow is provided. Owner approval alone does not implement missing safeguards; close the blockers and review the release artifact before requesting production approval.

## Implemented controls

- Scrypt password derivation with independent random salts; constant-time comparison; opaque random sessions stored as hashes; expiration and logout revocation.
- Server-side ownership checks across companies, jobs, applications and messages; negative tests for another company and candidate.
- Parameterized SQL and database uniqueness/foreign-key constraints; transactionally coupled application changes and inbox events.
- Explicit request models, rejected unknown fields, field/list limits and bounded list queries.
- Basic process-local auth throttling; no permissive CORS configuration; no raw CV persistence or external AI transfer.
- No sensitive content in notification payloads; APIs return only authorized resources. Non-root container with no capabilities, read-only filesystem and named data volume in Compose.

## Threat model

Assets: credentials, CVs, messages, employer applicant data and delivery tokens. Actors: anonymous spammer, malicious candidate, malicious employer, compromised dependency/provider and administrator. Boundaries: public API, organization ownership, worker/file sandbox, AI vendor, FCM, backups and developer machines.

| Finding | Severity before public use | Current disposition / required fix |
|---|---|---|
| Email/organization identity unverified | High | Development only; verification and moderation before public publishing |
| No distributed abuse controls | High | Local limiter only; edge + shared account/IP quotas; password reset controls |
| Request bodies parsed before model field checks | High | Edge max body size/timeouts/concurrency before public exposure |
| No data export/deletion or retention jobs | High | Implement policy plus lifecycle tests before real personal data |
| SQLite + no backup drill | High for production reliability | PostgreSQL migration and restore testing |
| No independent penetration test | Open review gate | Current review is implementation self-review with negative integration tests |
| No message reporting/blocking/spam moderation | High | Restrict to application parties now; complete controls before beta |
| No audit trail for state changes | Medium | Add immutable minimal audit events, access review and monitoring |
| One-hour tokens, no refresh/remote device revoke | Medium | Implement bounded rotation and device session controls |
| Email existence inferable at registration | Medium | Generic response and verified ownership flow |
| AI/file/push integrations absent | Not tested | Threat-test each integration when implemented; do not claim secured |

## Release checklist

- Required CI, dependency vulnerability audit, license inventory/SBOM, secret scan and pinned reviewed build inputs.
- Tests on PostgreSQL and Android device; load results against declared SLO; crash/error redaction.
- TLS, exact origin policy, trusted proxy configuration and edge limits; do not trust arbitrary X-Forwarded-For.
- KMS-backed secrets, least-privilege service accounts, private storage and encrypted backups.
- CV sandbox and scanner; SSRF protections and egress allowlist; AI prompt/output validation and no tool execution from CV text.
- Signed Android internal build and FCM token lifecycle verification.
- Market-specific privacy/AI/employment review, vendor agreements and licensed job feeds.
- Written approval from owner for the named image/build and target environment; rollback plan and monitoring owner.

Report vulnerabilities privately to repository owner; never attach live tokens or candidate CVs to issues.
