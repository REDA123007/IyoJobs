import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import type { MessageKey } from "../i18n/locales/en";

type Availability = "available" | "building" | "planned";

const STATUS_ROWS: { label: MessageKey; state: Availability }[] = [
  { label: "home.status.search", state: "available" },
  { label: "home.status.accounts", state: "building" },
  { label: "home.status.employers", state: "planned" },
];

const STATUS_TEXT: Record<Availability, MessageKey> = {
  available: "status.available",
  building: "status.building",
  planned: "status.planned",
};

const STATUS_ICON: Record<Availability, string> = { available: "✓", building: "◐", planned: "○" };

export function HomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/jobs?q=${encodeURIComponent(q)}` : "/jobs");
  }

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">{t("home.eyebrow")}</p>
            <h1>{t("home.title")}</h1>
            <p className="lead">{t("home.subtitle")}</p>

            <form className="hero-search" onSubmit={onSubmit} role="search">
              <label htmlFor="hero-q">{t("home.search.label")}</label>
              <div className="hero-search-row">
                <input
                  id="hero-q"
                  type="search"
                  value={query}
                  maxLength={180}
                  placeholder={t("home.search.placeholder")}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button type="submit" className="btn btn-primary">
                  {t("home.search.submit")}
                </button>
              </div>
              <Link to="/jobs" className="text-link">
                {t("home.search.browse")}
              </Link>
            </form>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="blob blob-sun" />
            <span className="blob blob-mint" />
            <span className="blob blob-sky" />
          </div>
        </div>
      </section>

      <section className="container page" aria-labelledby="values-title">
        <h2 id="values-title">{t("home.values.title")}</h2>
        <div className="grid-3">
          {(["search", "language", "honest"] as const).map((key) => (
            <article className="card value-card" key={key}>
              <h3>{t(`home.values.${key}.title`)}</h3>
              <p>{t(`home.values.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container page" aria-labelledby="status-title">
        <h2 id="status-title">{t("home.status.title")}</h2>
        <p className="lead">{t("home.status.intro")}</p>
        <ul className="status-list card">
          {STATUS_ROWS.map(({ label, state }) => (
            <li key={label} className={`status status-${state}`}>
              <span className="status-icon" aria-hidden="true">
                {STATUS_ICON[state]}
              </span>
              <span className="status-label">{t(label)}</span>
              <span className="status-text">{t(STATUS_TEXT[state])}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
