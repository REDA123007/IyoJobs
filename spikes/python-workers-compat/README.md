# Python Workers compatibility spike

**Purpose:** decide whether the existing FastAPI backend can run on Cloudflare Python Workers with few changes. Nothing here is production code and nothing is deployed.

It measures, inside the Workers runtime (Pyodide): `hashlib.scrypt` (current password hashing), `hashlib.pbkdf2_hmac`, `sqlite3`, and `threading.Lock` (used by the process-local rate limiter).

## Run (local only, no Cloudflare account needed)

```bash
cd spikes/python-workers-compat
npx wrangler@latest dev --port 8799
# in another terminal:
curl http://127.0.0.1:8799/
```

`wrangler dev` downloads the Pyodide bundle from Cloudflare on first run, so it needs normal internet access. The spike was attempted in the cloud build sandbox and **failed there on a DNS block** (`pyodide-capnp-bin.edgeworker.net`), so the results are **not yet known**.

## How to read the result

| Field | Meaning for the decision |
|---|---|
| `scrypt_n16384_ms` / `scrypt` error | If scrypt is missing or takes far above 10 ms, passwords must move to another KDF (a migration) and Workers Paid CPU limits are required. |
| `pbkdf2_100k_ms` | Fallback KDF cost. |
| `sqlite3` | If it works, it is only an in-memory engine — it does **not** replace D1 (durable). |
| `threading_lock` | Tells whether the in-process lock can stay. |

Send the JSON output back; it decides option A vs B in `docs/CLOUDFLARE-DECISION.ar.md`.
