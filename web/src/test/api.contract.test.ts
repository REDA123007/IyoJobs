// @vitest-environment node
/**
 * Contract test against the REAL Python API (not a mock).
 * It starts uvicorn on a temporary SQLite file, creates data through the public HTTP endpoints,
 * then reads it back through the web client's own parser. If the API response shape drifts,
 * this test fails. Needs Python 3.12+ with requirements-dev.lock installed.
 * Set IYOJOBS_PYTHON to choose the interpreter (default: python3).
 */
import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApi } from "../api/client";

const repoRoot = resolve(import.meta.dirname, "../../..");
let server: ChildProcess | undefined;
let dir = "";
let base = "";
let serverLog = "";

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => (typeof address === "object" && address ? resolvePort(address.port) : reject(new Error("no port"))));
    });
  });
}

async function waitForHealth(url: string): Promise<void> {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`API exited early (code ${server.exitCode}):\n${serverLog}`);
    }
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`API did not become healthy:\n${serverLog}`);
}

async function post(path: string, body: unknown, token?: string): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "iyojobs-contract-"));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(
    process.env.IYOJOBS_PYTHON ?? "python3",
    ["-I", "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_PATH: join(dir, "contract.db"), APP_ENV: "development", PYTHONPATH: repoRoot },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout?.on("data", (d: Buffer) => (serverLog += d.toString()));
  server.stderr?.on("data", (d: Buffer) => (serverLog += d.toString()));
  await waitForHealth(base);

  // Synthetic data only, created through the public API.
  const creds = { email: "employer.contract@example.com", password: "correct-horse-2026" };
  expect((await post("/auth/register", { ...creds, role: "employer", locale: "en" })).status).toBe(201);
  const login = await post("/auth/login", creds);
  const token = ((await login.json()) as { access_token: string }).access_token;
  const company = (await (await post("/companies", { name: "Contract Test Co" }, token)).json()) as { id: string };

  const rows = [
    { title: "مهندس Python", country: "MA", locale: "ar", remote: true, skills: ["python"] },
    { title: "Ingénieur données", country: "FR", locale: "fr", remote: false, skills: ["sql"] },
    ...Array.from({ length: 22 }, (_, i) => ({
      title: `Backend developer ${i + 1}`,
      country: "DE",
      locale: "en",
      remote: i % 2 === 0,
      skills: ["python", "docker"],
    })),
  ];
  for (const r of rows) {
    const res = await post(
      "/jobs",
      { company_id: company.id, description: "A synthetic job used only by the contract test.", ...r },
      token,
    );
    expect(res.status).toBe(201);
  }
}, 90_000);

afterAll(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 300));
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("web client against the real Python API", () => {
  const api = () => createApi(base);

  it("parses every job the server returns (shape contract)", async () => {
    const jobs = await api().searchJobs({ limit: 100 });
    expect(jobs).toHaveLength(24);
    expect(jobs.every((j) => j.status === "open")).toBe(true);
  });

  it("filters by country and remote exactly as the UI sends them", async () => {
    const morocco = await api().searchJobs({ country: "MA" });
    expect(morocco.map((j) => j.title)).toEqual(["مهندس Python"]);
    expect(morocco[0]).toMatchObject({ locale: "ar", remote: true, skills: ["python"] });

    const remoteGermany = await api().searchJobs({ country: "DE", remote: true, limit: 100 });
    expect(remoteGermany).toHaveLength(11);
    const onsiteGermany = await api().searchJobs({ country: "DE", remote: false, limit: 100 });
    expect(onsiteGermany).toHaveLength(11);
  });

  it("finds Arabic text through the keyword filter", async () => {
    const found = await api().searchJobs({ q: "مهندس" });
    expect(found).toHaveLength(1);
  });

  it("supports the limit+1 / offset paging the UI relies on", async () => {
    const first = await api().searchJobs({ country: "DE", limit: 21, offset: 0 });
    expect(first).toHaveLength(21); // 22 exist → UI sees "has next page"
    const second = await api().searchJobs({ country: "DE", limit: 21, offset: 20 });
    expect(second).toHaveLength(2);
    expect(new Set([...first.slice(0, 20), ...second].map((j) => j.id)).size).toBe(22); // no overlap, none missing
  });

  it("returns an empty list, not an error, when nothing matches", async () => {
    expect(await api().searchJobs({ q: "zzzz-no-such-job" })).toEqual([]);
  });

  it("surfaces server validation errors as ApiError", async () => {
    await expect(api().searchJobs({ country: "morocco" })).rejects.toMatchObject({ status: 422, code: "invalid_request" });
  });

  it("surfaces an unreachable server as a network error", async () => {
    await expect(createApi("http://127.0.0.1:1").searchJobs()).rejects.toMatchObject({ code: "network_error" });
  });
});
