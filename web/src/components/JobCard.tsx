import { useId } from "react";
import type { Job } from "../api/client";
import { countryName } from "../countries";
import { LANGS, langInfo, useI18n } from "../i18n";

function excerpt(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(clean); // code-point safe, so Arabic and emoji are never cut mid-character
  return chars.length > max ? `${chars.slice(0, max).join("").trimEnd()}…` : clean;
}

export function JobCard({ job }: { job: Job }) {
  const { lang, t } = useI18n();
  const titleId = useId();
  // The job's own language, kept apart from the interface language.
  const jobLang = langInfo(job.locale);
  const jobLangName = LANGS.find((l) => l.code === job.locale)?.name ?? job.locale;

  return (
    <article className="job-card" aria-labelledby={titleId}>
      <header>
        <h3 id={titleId} lang={jobLang.code} dir={jobLang.dir}>
          {job.title}
        </h3>
        <span className={`badge ${job.remote ? "badge-remote" : "badge-onsite"}`}>
          <span aria-hidden="true">{job.remote ? "◎" : "▣"}</span> {job.remote ? t("job.remote") : t("job.onsite")}
        </span>
      </header>

      <p className="job-excerpt" lang={jobLang.code} dir={jobLang.dir}>
        {excerpt(job.description)}
      </p>

      {job.skills.length > 0 && (
        <div className="job-skills">
          <span className="visually-hidden">{t("job.skills")}:</span>
          <ul className="chips" lang="en" dir="ltr">
            {job.skills.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="job-meta">
        <li>{t("job.location", { country: countryName(job.country, lang) })}</li>
        <li>{t("job.language", { lang: jobLangName })}</li>
        <li>{t("job.eligibility")}</li>
        <li>{t("job.source")}</li>
      </ul>
    </article>
  );
}
