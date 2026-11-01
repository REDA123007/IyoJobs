import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, type Job } from "../api/client";
import { useApi } from "../api/context";
import { CountryPicker } from "../components/CountryPicker";
import { JobCard } from "../components/JobCard";
import { useI18n } from "../i18n";

export const PAGE_SIZE = 20;

type RemoteFilter = "" | "remote" | "onsite";

type State =
  | { phase: "loading" }
  | { phase: "error"; error: ApiError | Error }
  | { phase: "success"; jobs: Job[]; hasNext: boolean };

function remoteFromParam(value: string | null): RemoteFilter {
  return value === "1" ? "remote" : value === "0" ? "onsite" : "";
}

export function JobsPage() {
  const { t } = useI18n();
  const api = useApi();
  const [params, setParams] = useSearchParams();

  const q = params.get("q") ?? "";
  const country = params.get("country") ?? "";
  const remote = remoteFromParam(params.get("remote"));
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  // Form fields are edited locally and only applied (written to the URL) on submit.
  const [qField, setQField] = useState(q);
  const [countryField, setCountryField] = useState(country);
  const [remoteField, setRemoteField] = useState<RemoteFilter>(remote);
  useEffect(() => {
    setQField(q);
    setCountryField(country);
    setRemoteField(remote);
  }, [q, country, remote]);

  const [state, setState] = useState<State>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: "loading" });
    api
      .searchJobs(
        {
          q: q || undefined,
          country: country || undefined,
          remote: remote === "" ? undefined : remote === "remote",
          limit: PAGE_SIZE + 1, // one extra row tells us whether a next page exists
          offset: (page - 1) * PAGE_SIZE,
        },
        controller.signal,
      )
      .then((rows) => {
        setState({ phase: "success", jobs: rows.slice(0, PAGE_SIZE), hasNext: rows.length > PAGE_SIZE });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ phase: "error", error: error instanceof Error ? error : new Error("unknown") });
      });
    return () => controller.abort();
  }, [api, q, country, remote, page, attempt]);

  function writeParams(next: { q: string; country: string; remote: RemoteFilter; page: number }) {
    const out = new URLSearchParams();
    if (next.q.trim()) out.set("q", next.q.trim());
    if (next.country) out.set("country", next.country);
    if (next.remote) out.set("remote", next.remote === "remote" ? "1" : "0");
    if (next.page > 1) out.set("page", String(next.page));
    setParams(out);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    writeParams({ q: qField, country: countryField, remote: remoteField, page: 1 });
  }

  function onReset() {
    setQField("");
    setCountryField("");
    setRemoteField("");
    setParams(new URLSearchParams());
  }

  return (
    <div className="container page">
      <h1>{t("jobs.title")}</h1>
      <p className="lead">{t("jobs.subtitle")}</p>

      <div className="jobs-layout">
        <form className="filters card" onSubmit={onSubmit} role="search" aria-label={t("jobs.filters.title")}>
          <h2 className="h3">{t("jobs.filters.title")}</h2>

          <div className="field">
            <label htmlFor="f-q">{t("jobs.filter.query")}</label>
            <input
              id="f-q"
              name="q"
              type="search"
              value={qField}
              maxLength={180}
              placeholder={t("jobs.filter.query.placeholder")}
              onChange={(event) => setQField(event.target.value)}
            />
          </div>

          <CountryPicker value={countryField} onChange={setCountryField} />

          <div className="field">
            <label htmlFor="f-remote">{t("jobs.filter.remote")}</label>
            <select
              id="f-remote"
              name="remote"
              value={remoteField}
              onChange={(event) => setRemoteField(event.target.value as RemoteFilter)}
            >
              <option value="">{t("jobs.filter.remote.any")}</option>
              <option value="remote">{t("jobs.filter.remote.remote")}</option>
              <option value="onsite">{t("jobs.filter.remote.onsite")}</option>
            </select>
            <p className="hint">{t("jobs.filter.note")}</p>
          </div>

          <div className="actions">
            <button type="submit" className="btn btn-primary">
              {t("jobs.filter.submit")}
            </button>
            <button type="button" className="btn btn-quiet" onClick={onReset}>
              {t("jobs.filter.reset")}
            </button>
          </div>
        </form>

        <section aria-label={t("jobs.title")} aria-busy={state.phase === "loading"}>
          <div role="status" aria-live="polite" className="results-status">
            {state.phase === "loading" && t("jobs.loading")}
            {state.phase === "success" && state.jobs.length > 0 && t("jobs.results", { n: state.jobs.length })}
          </div>

          {state.phase === "loading" && (
            <div className="skeleton-list" aria-hidden="true">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          )}

          {state.phase === "error" && (
            <div className="notice notice-error card" role="alert">
              <h2 className="h3">
                <span aria-hidden="true">⚠ </span>
                {t("jobs.error.title")}
              </h2>
              <p>{t("jobs.error.body")}</p>
              <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
                {t("jobs.error.retry")}
              </button>
            </div>
          )}

          {state.phase === "success" && state.jobs.length === 0 && (
            <div className="notice card">
              <h2 className="h3">{t("jobs.empty.title")}</h2>
              <p>{t("jobs.empty.body")}</p>
            </div>
          )}

          {state.phase === "success" && state.jobs.length > 0 && (
            <>
              <ul className="job-list">
                {state.jobs.map((job) => (
                  <li key={job.id}>
                    <JobCard job={job} />
                  </li>
                ))}
              </ul>
              <nav className="pager" aria-label={t("jobs.page.label", { n: page })}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page <= 1}
                  onClick={() => writeParams({ q, country, remote, page: page - 1 })}
                >
                  {t("jobs.page.prev")}
                </button>
                <span className="pager-label">{t("jobs.page.label", { n: page })}</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!state.hasNext}
                  onClick={() => writeParams({ q, country, remote, page: page + 1 })}
                >
                  {t("jobs.page.next")}
                </button>
              </nav>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
