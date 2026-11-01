import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  if (typeof document === "undefined") return; // node-environment tests (no DOM)
  cleanup();
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  try {
    window.localStorage.clear();
  } catch {
    /* not available in the node-environment tests */
  }
});
