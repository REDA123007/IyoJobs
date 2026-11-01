import { useId, useMemo, useState } from "react";
import { countryOptions, matchesQuery } from "../countries";
import { useI18n } from "../i18n";

interface Props {
  value: string;
  onChange: (code: string) => void;
}

/**
 * Every country, named in the interface language. A filter box narrows a native <select>,
 * which keeps full keyboard, screen-reader and mobile-picker behaviour.
 */
export function CountryPicker({ value, onChange }: Props) {
  const { lang, t } = useI18n();
  const [filter, setFilter] = useState("");
  const selectId = useId();
  const filterId = useId();

  const all = useMemo(() => countryOptions(lang), [lang]);
  const visible = useMemo(
    () => (filter.trim() ? all.filter((c) => c.code === value || matchesQuery(c.name, filter)) : all),
    [all, filter, value],
  );

  return (
    <div className="field">
      <label htmlFor={selectId}>{t("jobs.filter.country")}</label>
      <input
        id={filterId}
        type="search"
        className="country-filter"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder={t("jobs.filter.country.search")}
        aria-label={t("jobs.filter.country.search")}
        aria-controls={selectId}
        autoComplete="off"
      />
      <select id={selectId} name="country" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{t("jobs.filter.country.any")}</option>
        {visible.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
