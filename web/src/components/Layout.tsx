import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { LANGS, isLangCode, useI18n } from "../i18n";

const LOGO_RATIO = { width: 868, height: 597 }; // intrinsic size of brand/iyojobs-logo.png; never stretched

function Logo({ height }: { height: number }) {
  const width = Math.round((height * LOGO_RATIO.width) / LOGO_RATIO.height);
  return <img src="/brand/iyojobs-logo.png" alt="IyoJobs" width={width} height={height} className="logo" />;
}

function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-switcher">
      <label htmlFor="lang-select">{t("lang.label")}</label>
      <select
        id="lang-select"
        value={lang}
        onChange={(event) => {
          if (isLangCode(event.target.value)) setLang(event.target.value);
        }}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function PreviewBanner() {
  const { t } = useI18n();
  if (import.meta.env.VITE_APP_ENV === "production") return null;
  return (
    <div className="preview-banner" role="note">
      {t("preview.banner")}
    </div>
  );
}

/** Moves keyboard/screen-reader focus to the page content after in-app navigation. */
function RouteFocus({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    target.current?.focus();
  }, [pathname, target]);
  return null;
}

export function Layout() {
  const { t } = useI18n();
  const main = useRef<HTMLElement>(null);
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {t("a11y.skip")}
      </a>
      <PreviewBanner />
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand-link" aria-label="IyoJobs — Home">
            <Logo height={52} />
          </Link>
          <nav aria-label={t("nav.main")} className="main-nav">
            <NavLink to="/" end>
              {t("nav.home")}
            </NavLink>
            <NavLink to="/jobs">{t("nav.jobs")}</NavLink>
          </nav>
          <LanguageSwitcher />
        </div>
      </header>
      <main id="main" ref={main} tabIndex={-1}>
        <RouteFocus target={main} />
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Logo height={44} />
          <p>{t("footer.note")}</p>
          <p className="footer-rights">{t("footer.rights", { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  );
}
