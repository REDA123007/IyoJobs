import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, type MessageKey, type Messages } from "./locales/en";
import { ar } from "./locales/ar";
import { fr } from "./locales/fr";
import { ru } from "./locales/ru";
import { de } from "./locales/de";
import { it } from "./locales/it";
import { es } from "./locales/es";

export type LangCode = "ar" | "en" | "fr" | "ru" | "de" | "it" | "es";

export interface LangInfo {
  code: LangCode;
  /** The language's own name (endonym), shown in the language picker. */
  name: string;
  dir: "rtl" | "ltr";
}

export const LANGS: readonly LangInfo[] = [
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "en", name: "English", dir: "ltr" },
  { code: "fr", name: "Français", dir: "ltr" },
  { code: "ru", name: "Русский", dir: "ltr" },
  { code: "de", name: "Deutsch", dir: "ltr" },
  { code: "it", name: "Italiano", dir: "ltr" },
  { code: "es", name: "Español", dir: "ltr" },
];

export const MESSAGES: Record<LangCode, Messages> = { ar, en, fr, ru, de, it, es };

const STORAGE_KEY = "iyojobs.lang"; // a language preference is not sensitive data
const SUPPORTED = new Set<string>(LANGS.map((l) => l.code));

export function langInfo(code: LangCode): LangInfo {
  return LANGS.find((l) => l.code === code) ?? (LANGS[1] as LangInfo);
}

export function isLangCode(value: unknown): value is LangCode {
  return typeof value === "string" && SUPPORTED.has(value);
}

/** Pick the initial language: saved choice → browser preference → English. */
export function detectLang(saved: string | null, browserLanguages: readonly string[]): LangCode {
  if (isLangCode(saved)) return saved;
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLangCode(base)) return base;
  }
  return "en";
}

export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

interface I18nValue {
  lang: LangCode;
  dir: "rtl" | "ltr";
  setLang: (code: LangCode) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readSaved(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage can be blocked; the app must work without it
  }
}

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: LangCode }) {
  const [lang, setLangState] = useState<LangCode>(
    () => initial ?? detectLang(readSaved(), typeof navigator === "undefined" ? [] : navigator.languages ?? []),
  );
  const info = langInfo(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = info.dir;
  }, [lang, info.dir]);

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore: preference simply won't persist */
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: info.dir,
      setLang,
      t: (key, vars) => format(MESSAGES[lang][key] ?? en[key], vars),
    }),
    [lang, info.dir, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
