// Tests for the persistent workspace shell (backlog item 020): toolbar +
// vertical sidebar section list (built on `<wuik-tabs orientation="vertical">`,
// see .vibe/decisions/011-workspace-shell-tabs-composition-and-section-switch-detection.md)
// + exactly one section visible at a time in main, with per-section state
// preserved across switches and the Animation section auto-pausing when
// navigated away from.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Registers the `wuik-*` custom elements — normally done once by `main.ts`
// (the app's composition root) before any of these render functions ever
// run; this test exercises `<wuik-tabs>`'s real shadow-DOM tab-button
// behavior directly, so it needs that registration itself.
import "@openkakutou/web-ui-kit";
import type { CharacterData } from "../wasm/types.ts";
import { renderWorkspaceShell } from "./workspace-shell.ts";

function character(): CharacterData {
  return {
    name: "Ryu",
    animations: [
      {
        number: 0,
        frames: [
          {
            group: 0,
            image: 0,
            x: 0,
            y: 0,
            time: 3,
            flip: "",
            blend: "",
            clsn1: [],
            clsn2: [],
          },
          {
            group: 0,
            image: 1,
            x: 0,
            y: 0,
            time: 3,
            flip: "",
            blend: "",
            clsn1: [],
            clsn2: [],
          },
        ],
        loopStart: 0,
      },
    ],
    sprites: [
      {
        index: 0,
        sprites: [
          {
            group: 0,
            image: 0,
            width: 20,
            height: 20,
            axisX: 0,
            axisY: 0,
            palette: 0,
          },
          {
            group: 0,
            image: 1,
            width: 20,
            height: 20,
            axisX: 0,
            axisY: 0,
            palette: 0,
          },
        ],
      },
    ],
    stateDefs: [],
    palettes: [],
  };
}

const sffBytes = new Uint8Array([1, 2, 3]);

/**
 * Finds the Nth (0-indexed) real `role="tab"` button rendered by
 * `<wuik-tabs>`'s shadow DOM — the only way to trigger a real, user-shaped
 * section switch instead of reaching past the component's own selection
 * logic. `<wuik-tabs>` builds its tab buttons from a `slotchange` event
 * that (under jsdom, same as `web-ui-kit`'s own test suite) is not
 * necessarily flushed synchronously, so fake timers are advanced first to
 * flush it.
 */
async function tabButton(
  root: HTMLElement,
  index: number,
): Promise<HTMLButtonElement> {
  await vi.advanceTimersByTimeAsync(0);
  const tabs = root.querySelector("wuik-tabs");
  const button =
    tabs?.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[
      index
    ];
  if (!button) throw new Error(`tab button ${index} not found`);
  return button;
}

describe("renderWorkspaceShell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts a wuik-app-shell toolbar with the app title/version and the character's name", () => {
    const root = document.createElement("div");
    renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

    const shell = root.querySelector("wuik-app-shell");
    expect(shell).not.toBeNull();
    const toolbar = shell?.querySelector('[slot="toolbar"]');
    expect(toolbar?.tagName.toLowerCase()).toBe("wuik-toolbar");
    expect(toolbar?.textContent).toContain("v0.1.0");
    expect(toolbar?.textContent).toContain("Ryu");
  });

  it("leaves the app-shell's named sidebar slot empty (the section list is composed inside the vertical wuik-tabs unit in main — see decision 011)", () => {
    const root = document.createElement("div");
    renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

    expect(root.querySelector('[slot="sidebar"]')).toBeNull();
  });

  it("builds a vertical wuik-tabs sidebar with exactly the 5 in-scope sections, in order", () => {
    const root = document.createElement("div");
    renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

    const tabs = root.querySelector("wuik-tabs");
    expect(tabs?.getAttribute("orientation")).toBe("vertical");
    const panels = Array.from(root.querySelectorAll("wuik-tab-panel"));
    expect(panels.map((panel) => panel.getAttribute("label"))).toEqual([
      "Characteristics",
      "Palette",
      "Sprites",
      "Animation",
      "In-game preview",
    ]);
  });

  it("lands on Characteristics by default, with its content visible and every other section already mounted but hidden", () => {
    const root = document.createElement("div");
    renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

    expect(root.querySelector(".characteristics-panel")).not.toBeNull();
    expect(root.querySelector(".palette-picker")).not.toBeNull();
    expect(root.querySelector(".sprite-browser")).not.toBeNull();
    expect(root.querySelector(".animation-player")).not.toBeNull();
    expect(root.querySelector(".animation-triggers")).not.toBeNull();

    const panels = Array.from(
      root.querySelectorAll<HTMLElement>("wuik-tab-panel"),
    );
    expect(panels[0].hidden).toBe(false);
  });

  it("preserves a section's own state (an expanded sprite group) when navigating away and back", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    try {
      renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

      (await tabButton(root, 2)).click(); // Sprites
      await vi.waitFor(() =>
        expect(
          root
            .querySelector("wuik-tabs")
            ?.shadowRoot?.querySelector('[aria-selected="true"]')?.textContent,
        ).toBe("Sprites"),
      );

      const groupToggle = root.querySelector<HTMLButtonElement>(
        ".sprite-browser__group-toggle",
      );
      groupToggle?.click();
      expect(groupToggle?.getAttribute("aria-expanded")).toBe("true");

      (await tabButton(root, 0)).click(); // Characteristics
      (await tabButton(root, 2)).click(); // back to Sprites

      expect(
        root
          .querySelector(".sprite-browser__group-toggle")
          ?.getAttribute("aria-expanded"),
      ).toBe("true");
    } finally {
      root.remove();
    }
  });

  it("does not destroy or re-render a section's DOM when switching away from it", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    try {
      renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

      const characteristicsPanel = root.querySelector(".characteristics-panel");
      (await tabButton(root, 1)).click(); // Palette
      (await tabButton(root, 0)).click(); // back to Characteristics

      expect(root.querySelector(".characteristics-panel")).toBe(
        characteristicsPanel,
      );
    } finally {
      root.remove();
    }
  });

  it("pauses Animation playback when the user navigates to a different section, without resuming it automatically on return", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    try {
      renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

      (await tabButton(root, 3)).click(); // Animation
      await vi.waitFor(() =>
        expect(root.querySelector(".animation-player")).not.toBeNull(),
      );

      const playButton = root.querySelector<HTMLButtonElement>(
        ".animation-player__play-pause",
      );
      playButton?.click();
      expect(playButton?.getAttribute("aria-pressed")).toBe("true");

      (await tabButton(root, 0)).click(); // Characteristics — navigate away while playing
      await vi.waitFor(() =>
        expect(playButton?.getAttribute("aria-pressed")).toBe("false"),
      );
      expect(playButton?.textContent).toContain("Play");

      // Advancing time after leaving must not silently resume playback.
      await vi.advanceTimersByTimeAsync(1000);
      expect(playButton?.getAttribute("aria-pressed")).toBe("false");
    } finally {
      root.remove();
    }
  });

  it("pauses In-game preview playback when the user navigates to a different section, without resuming it automatically on return", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    try {
      renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

      (await tabButton(root, 4)).click(); // In-game preview
      await vi.waitFor(() =>
        expect(root.querySelector(".animation-triggers")).not.toBeNull(),
      );

      const triggerButton = root.querySelector<HTMLButtonElement>(
        ".animation-triggers__trigger",
      );
      triggerButton?.click();
      expect(triggerButton?.getAttribute("aria-pressed")).toBe("true");

      (await tabButton(root, 0)).click(); // Characteristics — navigate away while playing
      await vi.waitFor(() =>
        expect(triggerButton?.getAttribute("aria-pressed")).toBe("false"),
      );

      // Advancing time after leaving must not silently resume playback.
      await vi.advanceTimersByTimeAsync(1000);
      expect(triggerButton?.getAttribute("aria-pressed")).toBe("false");
    } finally {
      root.remove();
    }
  });

  it("moves focus to Characteristics' own heading once the shell first mounts", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    try {
      renderWorkspaceShell(root, "0.1.0", character(), sffBytes);
      expect(document.activeElement?.className).toContain(
        "characteristics-panel__name",
      );
    } finally {
      root.remove();
    }
  });

  it("moves focus to the newly visible section's own heading when switching sections", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    try {
      renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

      (await tabButton(root, 2)).click(); // Sprites
      await vi.waitFor(() =>
        expect(document.activeElement?.textContent).toContain("Sprites ("),
      );
    } finally {
      root.remove();
    }
  });

  it("replaces all previous content on repeated renders instead of appending", () => {
    const root = document.createElement("div");
    renderWorkspaceShell(root, "0.1.0", character(), sffBytes);
    renderWorkspaceShell(root, "0.2.0", character(), sffBytes);

    expect(root.querySelectorAll("wuik-app-shell")).toHaveLength(1);
    expect(root.querySelectorAll("wuik-tabs")).toHaveLength(1);
  });
});
