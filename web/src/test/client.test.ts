// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ApiError, createApi, parseJob } from "../api/client";

const validJob = {
  id: "abc",
  company_id: "c1",
  title: "مهندس Python",
  description: "Build reliable services with Python and SQL",
  country: "MA",
  locale: "ar",
  skills: ["python", "sql"],
  remote: true,
  status: "open",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("parseJob", () => {
  it("accepts a valid job", () => expect(parseJob(validJob)).toEqual(validJob));
  it.each([
    ["missing title", { ...validJob, title: undefined }],
    ["unknown locale", { ...validJob, locale: "zz" }],
    ["skills not strings", { ...validJob, skills: [1] }],
    ["remote not boolean", { ...validJob, remote: "yes" }],
    ["not an object", "nope"],
    ["null", null],
  ])("rejects %s", (_name, value) => {
    expect(() => parseJob(value)).toThrowError(ApiError);
  });
});

describe("searchJobs", () => {
  it("builds the query string and parses the reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([validJob]));
    const api = createApi("/api", fetchMock as unknown as typeof fetch);
    const jobs = await api.searchJobs({ q: "مهندس", country: "MA", remote: false, limit: 21, offset: 20 });
    expect(jobs).toHaveLength(1);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://x");
    expect(url.pathname).toBe("/api/jobs");
    expect(url.searchParams.get("q")).toBe("مهندس");
    expect(url.searchParams.get("country")).toBe("MA");
    expect(url.searchParams.get("remote")).toBe("false"); // false must be sent, not dropped
    expect(url.searchParams.get("limit")).toBe("21");
    expect(url.searchParams.get("offset")).toBe("20");
  });

  it("omits empty filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    await createApi("/api", fetchMock as unknown as typeof fetch).searchJobs({});
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/jobs");
  });

  it("maps a network failure", async () => {
    const api = createApi("/api", vi.fn().mockRejectedValue(new TypeError("offline")) as unknown as typeof fetch);
    await expect(api.searchJobs()).rejects.toMatchObject({ code: "network_error", status: null });
  });

  it("maps validation and server errors", async () => {
    const f422 = vi.fn().mockResolvedValue(jsonResponse({ detail: [{ msg: "bad" }] }, 422));
    await expect(createApi("/api", f422 as unknown as typeof fetch).searchJobs()).rejects.toMatchObject({
      status: 422,
      code: "invalid_request",
    });
    const f500 = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(createApi("/api", f500 as unknown as typeof fetch).searchJobs()).rejects.toMatchObject({
      status: 500,
      code: "request_failed",
    });
  });

  it("rejects a reply that is not a list of jobs", async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ jobs: [] }));
    await expect(createApi("/api", f as unknown as typeof fetch).searchJobs()).rejects.toMatchObject({
      code: "unexpected_response",
    });
  });

  it("passes the abort signal through and re-throws aborts untouched", async () => {
    const controller = new AbortController();
    const f = vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"));
    await expect(createApi("/api", f as unknown as typeof fetch).searchJobs({}, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(f.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
  });
});
