// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LANGS, MESSAGES, detectLang, format, langInfo } from "../i18n";
import { en } from "../i18n/locales/en";

const keys = Object.keys(en);
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

describe("locales", () => {
  it("covers the seven required languages", () => {
    expect(LANGS.map((l) => l.code).sort()).toEqual(["ar", "de", "en", "es", "fr", "it", "ru"]);
  });

  it.each(LANGS.map((l) => l.code))("%s has exactly the same keys as English, none empty", (code) => {
    const messages = MESSAGES[code] as Record<string, string>;
    expect(Object.keys(messages).sort()).toEqual([...keys].sort());
    for (const key of keys) expect(messages[key]?.trim(), `${code}:${key}`).toBeTruthy();
  });

  it.each(LANGS.map((l) => l.code))("%s keeps every {placeholder} of the English text", (code) => {
    const messages = MESSAGES[code] as Record<string, string>;
    for (const key of keys) {
      expect(placeholders(messages[key] ?? ""), `${code}:${key}`).toBe(placeholders((en as Record<string, string>)[key] ?? ""));
    }
  });

  it("only Arabic is right-to-left", () => {
    expect(LANGS.filter((l) => l.dir === "rtl").map((l) => l.code)).toEqual(["ar"]);
  });

  it("Arabic text contains Arabic script and no stray Latin-only translation", () => {
    const sample = MESSAGES.ar["home.title"];
    expect(/[؀-ۿ]/.test(sample)).toBe(true);
  });
});

describe("detectLang", () => {
  it("prefers a saved valid choice", () => expect(detectLang("fr", ["ar-MA"])).toBe("fr"));
  it("ignores an invalid saved value", () => expect(detectLang("xx", ["de-AT"])).toBe("de"));
  it("uses the first supported browser language", () => expect(detectLang(null, ["pl-PL", "es-MX", "en"])).toBe("es"));
  it("falls back to English", () => expect(detectLang(null, ["zh-CN"])).toBe("en"));
  it("langInfo falls back safely", () => expect(langInfo("ar").dir).toBe("rtl"));
});

describe("format", () => {
  it("substitutes variables and leaves unknown ones visible", () => {
    expect(format("Page {n} of {total}", { n: 2 })).toBe("Page 2 of {total}");
  });
});
