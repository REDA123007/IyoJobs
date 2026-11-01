// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokensCss = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf-8");
const appCss = readFileSync(new URL("../styles/app.css", import.meta.url), "utf-8");

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokensCss);
  if (!match?.[1]) throw new Error(`Token --${name} not found as a 6-digit hex color`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = "#ffffff";

describe("WCAG 2.2 AA text contrast (4.5:1)", () => {
  const text: [string, string, string][] = [
    ["body text on page background", token("color-text"), token("color-bg")],
    ["body text on cards", token("color-text"), token("color-surface")],
    ["muted text on page background", token("color-text-muted"), token("color-bg")],
    ["muted text on cards", token("color-text-muted"), token("color-surface")],
    ["headings (brand green) on page background", token("color-brand-900"), token("color-bg")],
    ["white on primary button", WHITE, token("color-brand-900")],
    ["white on primary button hover (#0a4a05)", WHITE, "#0a4a05"],
    ["links (brand-700) on cards", token("color-brand-700"), token("color-surface")],
    ["links (brand-700) on page background", token("color-brand-700"), token("color-bg")],
    ["orange text (accent-700) on page background", token("color-accent-700"), token("color-bg")],
    ["orange text (accent-700) on cards", token("color-accent-700"), token("color-surface")],
    ["eyebrow/banner: brand green on warm yellow", token("color-brand-900"), token("color-sun-200")],
    ["remote badge: brand green on sky", token("color-brand-900"), token("color-sky-100")],
    ["on-site badge: brand green on mint", token("color-brand-900"), token("color-brand-100")],
    ["chips: text on brand-50", token("color-text"), token("color-brand-50")],
    ["error heading on cards", token("color-danger-700"), token("color-surface")],
  ];
  it.each(text)("%s", (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("WCAG non-text contrast (3:1)", () => {
  const ui: [string, string, string][] = [
    ["form field border on card/white", token("color-border-strong"), WHITE],
    ["focus ring on page background", token("color-brand-900"), token("color-bg")],
    ["logo orange accent on header green", token("color-accent-500"), token("color-brand-900")],
  ];
  it.each(ui)("%s", (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});

describe("logo orange is decorative only", () => {
  it("measured ratio on white is below 4.5, which is why it must never colour text", () => {
    expect(contrast(token("color-accent-500"), WHITE)).toBeLessThan(4.5);
  });
  it("no rule uses the logo orange as a text colour", () => {
    expect(/(^|[;{\s])color:\s*var\(--color-accent-500\)/m.test(appCss)).toBe(false);
  });
});

describe("brand colours match the supplied logo", () => {
  it("uses the sampled logo green and orange", () => {
    expect(token("color-brand-900").toLowerCase()).toBe("#023b00");
    expect(token("color-accent-500").toLowerCase()).toBe("#ff5925");
  });
});

describe("stylesheet uses logical properties", () => {
  it("has no physical left/right/margin-left/padding-right etc.", () => {
    const physical = /(^|[;{\s])(margin|padding|border)-(left|right)\s*:|(^|[;{\s])(left|right)\s*:|text-align:\s*(left|right)/m;
    expect(physical.test(appCss)).toBe(false);
  });
});
