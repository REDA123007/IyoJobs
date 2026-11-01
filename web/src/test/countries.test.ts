// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ALL_COUNTRY_CODES, ISO_COUNTRY_CODES, countryName, countryOptions, matchesQuery } from "../countries";
import { LANGS } from "../i18n";

describe("country list", () => {
  it("contains all 249 ISO 3166-1 alpha-2 codes, no duplicates", () => {
    expect(ISO_COUNTRY_CODES).toHaveLength(249);
    expect(new Set(ALL_COUNTRY_CODES).size).toBe(ALL_COUNTRY_CODES.length);
    expect(ISO_COUNTRY_CODES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
  });

  it.each(LANGS.map((l) => l.code))("every code has a real name in %s (not just the code)", (lang) => {
    const unnamed = ALL_COUNTRY_CODES.filter((code) => countryName(code, lang) === code);
    expect(unnamed).toEqual([]);
  });

  it("names follow the interface language", () => {
    expect(countryName("MA", "en")).toBe("Morocco");
    expect(countryName("MA", "fr")).toBe("Maroc");
    expect(countryName("MA", "ar")).toBe("المغرب");
    expect(countryName("DE", "de")).toBe("Deutschland");
    expect(countryName("RU", "ru")).toBe("Россия");
  });

  it("is sorted for the language in use", () => {
    const names = countryOptions("fr").map((c) => c.name);
    const sorted = [...names].sort(new Intl.Collator("fr").compare);
    expect(names).toEqual(sorted);
  });
});

describe("matchesQuery", () => {
  it("ignores case and accents", () => {
    expect(matchesQuery("Côte d’Ivoire", "cote")).toBe(true);
    expect(matchesQuery("Österreich", "osterreich")).toBe(true);
    expect(matchesQuery("Morocco", "MOR")).toBe(true);
    expect(matchesQuery("Morocco", "xyz")).toBe(false);
  });
  it("an empty query matches everything", () => expect(matchesQuery("Anything", "  ")).toBe(true));
});
