export type JobLocale = "ar" | "en" | "fr";

/** Shape returned by GET /jobs (see docs/openapi.json). */
export interface Job {
  id: string;
  company_id: string;
  title: string;
  description: string;
  country: string;
  locale: JobLocale;
  skills: string[];
  remote: boolean;
  status: "open" | "closed";
}

export interface JobsQuery {
  q?: string;
  country?: string;
  remote?: boolean;
  limit?: number;
  offset?: number;
}

export class ApiError extends Error {
  /** HTTP status, or null when the network failed or the reply was unusable. */
  readonly status: number | null;
  readonly code: string;
  constructor(status: number | null, code: string) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Validates one job from the server instead of trusting its shape. */
export function parseJob(value: unknown): Job {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.company_id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.country !== "string" ||
    (value.locale !== "ar" && value.locale !== "en" && value.locale !== "fr") ||
    !Array.isArray(value.skills) ||
    !value.skills.every((s) => typeof s === "string") ||
    typeof value.remote !== "boolean" ||
    (value.status !== "open" && value.status !== "closed")
  ) {
    throw new ApiError(null, "unexpected_response");
  }
  return {
    id: value.id,
    company_id: value.company_id,
    title: value.title,
    description: value.description,
    country: value.country,
    locale: value.locale,
    skills: value.skills as string[],
    remote: value.remote,
    status: value.status,
  };
}

export function createApi(base: string = import.meta.env?.VITE_API_BASE ?? "/api", fetchImpl?: typeof fetch) {
  const doFetch: typeof fetch = fetchImpl ?? ((...args) => fetch(...args));

  async function request(path: string, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, { signal, headers: { Accept: "application/json" } });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new ApiError(null, "network_error");
    }
    if (!response.ok) {
      let code = "request_failed";
      try {
        const body: unknown = await response.json();
        if (isRecord(body) && typeof body.detail === "string") code = body.detail;
        else if (response.status === 422) code = "invalid_request";
      } catch {
        /* keep the generic code */
      }
      throw new ApiError(response.status, code);
    }
    try {
      return await response.json();
    } catch {
      throw new ApiError(null, "unexpected_response");
    }
  }

  async function searchJobs(query: JobsQuery = {}, signal?: AbortSignal): Promise<Job[]> {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.country) params.set("country", query.country);
    if (query.remote !== undefined) params.set("remote", String(query.remote));
    if (query.limit !== undefined) params.set("limit", String(query.limit));
    if (query.offset !== undefined) params.set("offset", String(query.offset));
    const qs = params.toString();
    const data = await request(`/jobs${qs ? `?${qs}` : ""}`, signal);
    if (!Array.isArray(data)) throw new ApiError(null, "unexpected_response");
    return data.map(parseJob);
  }

  return { searchJobs };
}

export type Api = ReturnType<typeof createApi>;
