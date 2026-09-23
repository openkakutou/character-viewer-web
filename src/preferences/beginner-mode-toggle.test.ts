// Tests for the "Beginner mode" toggle rendered inside the Preferences
// popup (backlog item 022): a labelled checkbox reflecting/driving the
// shared session-scoped preferences.ts state.
import { afterEach, describe, expect, it } from "vitest";
import { renderBeginnerModeToggle } from "./beginner-mode-toggle.ts";
import {
  isBeginnerMode,
  resetPreferencesForTests,
  setBeginnerMode,
} from "./preferences.ts";

describe("renderBeginnerModeToggle", () => {
  afterEach(() => {
    resetPreferencesForTests();
  });

  it("starts unchecked, matching beginner mode's off-by-default state", () => {
    const root = document.createElement("div");
    renderBeginnerModeToggle(root);

    const checkbox = root.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkbox?.checked).toBe(false);
  });

  it("starts checked when beginner mode is already on", () => {
    setBeginnerMode(true);
    const root = document.createElement("div");
    renderBeginnerModeToggle(root);

    const checkbox = root.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkbox?.checked).toBe(true);
  });

  it("renders a label reading 'Beginner mode' and an explanatory hint", () => {
    const root = document.createElement("div");
    renderBeginnerModeToggle(root);

    expect(root.textContent).toContain("Beginner mode");
    expect(root.textContent).toContain(
      "Show explanations for MUGEN/Ikemen terms across the app.",
    );
  });

  it("turns beginner mode on when the checkbox is clicked", () => {
    const root = document.createElement("div");
    renderBeginnerModeToggle(root);
    const checkbox = root.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );

    checkbox?.dispatchEvent(new MouseEvent("click"));

    expect(isBeginnerMode()).toBe(true);
  });

  it("turns beginner mode back off when clicked a second time", () => {
    const root = document.createElement("div");
    renderBeginnerModeToggle(root);
    const checkbox = root.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );

    checkbox?.dispatchEvent(new MouseEvent("click"));
    checkbox?.dispatchEvent(new MouseEvent("click"));

    expect(isBeginnerMode()).toBe(false);
  });

  it("reflects a beginner-mode change made elsewhere while mounted", () => {
    const root = document.createElement("div");
    renderBeginnerModeToggle(root);
    const checkbox = root.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );

    setBeginnerMode(true);

    expect(checkbox?.checked).toBe(true);
  });

  it("replaces previous content on repeated renders instead of appending", () => {
    const root = document.createElement("div");
    renderBeginnerModeToggle(root);
    renderBeginnerModeToggle(root);

    expect(root.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
  });
});
