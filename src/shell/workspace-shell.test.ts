// Tests for the persistent workspace shell (backlog item 020): toolbar +
// vertical sidebar section list (built on `<wuik-tabs orientation="vertical">`,
// see .vibe/decisions/011-workspace-shell-tabs-composition-and-section-switch-detection.md)
// + exactly one section visible at a time in main, with per-section state
// preserved across switches and the Animation section auto-pausing when
// navigated away from.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Registers the `wuik-*` custom elements — normally done once by `main.ts`
// (the app's composition root) before any of these render functions ever
// run; this test exercises `<wuik-tabs>`'s real shadow-DOM tab-button
// behavior directly, so it needs that registration itself.
import "@openkakutou/web-ui-kit";
import { initAppI18n } from "../i18n/i18n.ts";
import { resetPreferencesForTests } from "../preferences/preferences.ts";
import { resetWasmBridgeForTests } from "../wasm/bridge.ts";
import type { WasmBridgeOptions } from "../wasm/bridge.ts";
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
    stateDefs: [
      {
        number: 0,
        type: "S",
        moveType: "I",
        physics: "S",
        anim: 0,
        ctrl: true,
        powerAdd: 0,
        juggle: 0,
        faceP2: false,
        hitDefPersist: false,
        moveHitPersist: false,
        hitCountPersist: false,
        sprPriority: 0,
        headerExprs: {},
        controllers: [],
      },
    ],
    palettes: [],
    author: "",
    spriteFile: "",
    animationFile: "",
    soundFile: "",
    commandFile: "",
    constantsFile: "",
    stateFiles: [],
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

  it("builds a vertical wuik-tabs sidebar with exactly the 6 in-scope sections, in order", () => {
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
      "Special Moves",
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
    expect(root.querySelector(".special-move-list")).not.toBeNull();

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

  it("pauses Special Moves playback when the user navigates to a different section, without resuming it automatically on return", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    try {
      renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

      (await tabButton(root, 5)).click(); // Special Moves
      await vi.waitFor(() =>
        expect(root.querySelector(".special-move-list")).not.toBeNull(),
      );

      const triggerButton = root.querySelector<HTMLButtonElement>(
        ".special-move-list__trigger",
      );
      triggerButton?.click();
      await vi.waitFor(() =>
        expect(triggerButton?.getAttribute("aria-pressed")).toBe("true"),
      );

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

  it("opens the Preferences popup showing the Beginner mode toggle, off by default", () => {
    const root = document.createElement("div");
    renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

    const dialog = root.querySelector<HTMLElement>(
      ".workspace-shell__preferences-dialog",
    );
    expect(dialog?.hasAttribute("open")).toBe(false);

    root
      .querySelector<HTMLElement>('[data-action="preferences"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(dialog?.hasAttribute("open")).toBe(true);
    const checkbox = dialog?.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkbox?.checked).toBe(false);
    expect(dialog?.textContent).toContain("Beginner mode");
  });

  describe("Beginner-mode tooltips (backlog item 022)", () => {
    afterEach(() => {
      resetPreferencesForTests();
    });

    it("shows an info icon next to the States heading only once beginner mode is turned on", async () => {
      const root = document.createElement("div");
      document.body.appendChild(root);
      try {
        renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

        expect(
          root.querySelector<HTMLElement>(
            ".characteristics-panel__states .info-tooltip",
          )?.hidden,
        ).toBe(true);

        root
          .querySelector<HTMLElement>('[data-action="preferences"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        const checkbox = root.querySelector<HTMLInputElement>(
          'input[type="checkbox"]',
        );
        checkbox?.dispatchEvent(new MouseEvent("click"));

        const tooltip = root.querySelector<HTMLElement>(
          ".characteristics-panel__states .info-tooltip",
        );
        expect(tooltip).not.toBeNull();
        expect(tooltip?.hidden).toBe(false);
      } finally {
        root.remove();
      }
    });

    it("hides every info icon across sections again when beginner mode is turned back off", async () => {
      const root = document.createElement("div");
      document.body.appendChild(root);
      try {
        renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

        root
          .querySelector<HTMLElement>('[data-action="preferences"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        const checkbox = root.querySelector<HTMLInputElement>(
          'input[type="checkbox"]',
        );
        checkbox?.dispatchEvent(new MouseEvent("click")); // on
        checkbox?.dispatchEvent(new MouseEvent("click")); // off

        const tooltips = root.querySelectorAll<HTMLElement>(".info-tooltip");
        expect(tooltips.length).toBeGreaterThan(0);
        for (const tooltip of tooltips) {
          expect(tooltip.hidden).toBe(true);
        }
      } finally {
        root.remove();
      }
    });

    it("keeps beginner mode's info icons visible for the new character after a character switch", async () => {
      const root = document.createElement("div");
      document.body.appendChild(root);
      try {
        renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

        root
          .querySelector<HTMLElement>('[data-action="preferences"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        root
          .querySelector<HTMLInputElement>('input[type="checkbox"]')
          ?.dispatchEvent(new MouseEvent("click"));

        renderWorkspaceShell(root, "0.1.0", character(), sffBytes); // re-render, as a character switch would

        const tooltip = root.querySelector<HTMLElement>(
          ".characteristics-panel__states .info-tooltip",
        );
        expect(tooltip?.hidden).toBe(false);
      } finally {
        root.remove();
      }
    });
  });

  it("renders a locale switcher in the toolbar, labelled for accessibility", () => {
    const root = document.createElement("div");
    renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

    const switcher = root.querySelector("wuik-locale-switcher");
    expect(switcher).not.toBeNull();
    expect(switcher?.getAttribute("label")).toBe("Language");
    expect(root.querySelector('[slot="toolbar"]')?.contains(switcher)).toBe(
      true,
    );
  });

  describe("live locale switching", () => {
    afterEach(async () => {
      window.localStorage.clear();
    });

    it("retranslates the sidebar section labels and the locale switcher's own label when the locale changes, preserving the current selection and every section's own mounted state", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      const root = document.createElement("div");
      document.body.appendChild(root);
      try {
        renderWorkspaceShell(root, "0.1.0", character(), sffBytes);

        (await tabButton(root, 2)).click(); // Sprites
        await vi.waitFor(() =>
          expect(
            root
              .querySelector("wuik-tabs")
              ?.shadowRoot?.querySelector('[aria-selected="true"]')
              ?.textContent,
          ).toBe("Sprites"),
        );
        const groupToggle = root.querySelector<HTMLButtonElement>(
          ".sprite-browser__group-toggle",
        );
        groupToggle?.click();
        expect(groupToggle?.getAttribute("aria-expanded")).toBe("true");

        await instance.changeLanguage("fr");

        await vi.waitFor(() => {
          expect(
            root.querySelector("wuik-locale-switcher")?.getAttribute("label"),
          ).toBe("Langue");
        });
        const tabs = root.querySelector("wuik-tabs");
        const tabTexts = Array.from(
          tabs?.shadowRoot?.querySelectorAll('[role="tab"]') ?? [],
        ).map((el) => el.textContent);
        expect(tabTexts).toEqual([
          "Caractéristiques",
          "Palette",
          "Sprites",
          "Animation",
          "Aperçu en jeu",
          "Coups spéciaux",
        ]);
        expect(
          Array.from(root.querySelectorAll("wuik-tab-panel")).map((panel) =>
            panel.getAttribute("label"),
          ),
        ).toEqual([
          "Caractéristiques",
          "Palette",
          "Sprites",
          "Animation",
          "Aperçu en jeu",
          "Coups spéciaux",
        ]);
        // The Sprites tab is still the selected one, and its own expanded
        // group survived the retranslation untouched.
        expect(
          tabs?.shadowRoot?.querySelector('[aria-selected="true"]')
            ?.textContent,
        ).toBe("Sprites");
        expect(
          root
            .querySelector(".sprite-browser__group-toggle")
            ?.getAttribute("aria-expanded"),
        ).toBe("true");

        await instance.changeLanguage("en");
      } finally {
        root.remove();
      }
    });
  });
});

/**
 * Tests for the "Load character…" popup (backlog item 021): a toolbar
 * button opens a `<wuik-dialog>` hosting the same folder-based
 * `character-file-input-view.ts` widget the launch screen uses, so a
 * different character can be loaded mid-session without tearing down the
 * one already loaded until the new one actually validates. Real timers
 * (not `vi.useFakeTimers()`, unlike the describe block above) — the folder
 * load path goes through real `FileReader`/WASM async work that fake timers
 * would only complicate, matching `character-file-input-view.test.ts`'s own
 * convention.
 */
describe("Load character… popup (backlog item 021)", () => {
  const publicWasmDir = path.resolve(
    import.meta.dirname,
    "..",
    "..",
    "public",
    "wasm",
  );
  const testOptions: WasmBridgeOptions = {
    fetchWasmExecSource: async () =>
      readFileSync(path.join(publicWasmDir, "wasm_exec.js"), "utf-8"),
    fetchWasmBytes: async () =>
      new Uint8Array(readFileSync(path.join(publicWasmDir, "character.wasm"))),
  };
  const testdataDir = path.resolve(
    import.meta.dirname,
    "..",
    "wasm",
    "testdata",
  );

  function fixtureBytes(name: string): Uint8Array {
    return new Uint8Array(readFileSync(path.join(testdataDir, name)));
  }

  function defText(name: string, basename = "ryu"): string {
    return `[Info]\nname = ${name}\n\n[Files]\nsprite = ${basename}.sff\nanim = ${basename}.air\ncns = ${basename}.cns\n`;
  }

  /** Mirrors `character-file-input-view.test.ts`'s own `makeFile` — the
   * `BufferSource` cast works around a `Uint8Array<ArrayBufferLike>` vs
   * `BlobPart`'s stricter `ArrayBufferView<ArrayBuffer>` mismatch in the
   * pinned TypeScript DOM lib. */
  function makeFile(name: string, contents: BlobPart | Uint8Array): File {
    return new File([contents as BufferSource], name);
  }

  function withRelativePath(file: File, relativePath: string): File {
    Object.defineProperty(file, "webkitRelativePath", {
      value: relativePath,
    });
    return file;
  }

  /** A complete, valid folder — a real WASM `loadCharacter` call succeeds. */
  function completeFolderFiles(name: string): File[] {
    return [
      withRelativePath(makeFile("ryu.def", defText(name)), "ryu/ryu.def"),
      withRelativePath(
        makeFile("ryu.air", fixtureBytes("sample.air")),
        "ryu/ryu.air",
      ),
      withRelativePath(
        makeFile("ryu.sff", fixtureBytes("v1-basic.sff")),
        "ryu/ryu.sff",
      ),
      withRelativePath(
        makeFile("ryu.cns", fixtureBytes("sample.cns")),
        "ryu/ryu.cns",
      ),
    ];
  }

  /** Two `.def` candidates — resolves synchronously to "needs-selection", no WASM call. */
  function twoDefCandidateFiles(): File[] {
    return [
      withRelativePath(
        makeFile("one.def", defText("Candidate One")),
        "folder/one.def",
      ),
      withRelativePath(
        makeFile("two.def", defText("Candidate Two")),
        "folder/two.def",
      ),
    ];
  }

  /** A `.def` referencing a `.cns` that isn't in the folder — fails before any WASM call. */
  function folderMissingCns(name: string): File[] {
    return [
      withRelativePath(makeFile("ryu.def", defText(name)), "ryu/ryu.def"),
      withRelativePath(
        makeFile("ryu.air", fixtureBytes("sample.air")),
        "ryu/ryu.air",
      ),
      withRelativePath(
        makeFile("ryu.sff", fixtureBytes("v1-basic.sff")),
        "ryu/ryu.sff",
      ),
    ];
  }

  function character(name = "Ryu"): CharacterData {
    return {
      name,
      animations: [],
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
          ],
        },
      ],
      stateDefs: [],
      palettes: [],
      author: "",
      spriteFile: "",
      animationFile: "",
      soundFile: "",
      commandFile: "",
      constantsFile: "",
      stateFiles: [],
    };
  }

  const sffBytes = new Uint8Array([1, 2, 3]);

  function loadCharacterButton(root: HTMLElement): HTMLElement {
    const button = root.querySelector<HTMLElement>(
      '[data-action="load-character"]',
    );
    if (!button) throw new Error("Load character… button not found");
    return button;
  }

  function dialog(root: HTMLElement): HTMLElement {
    const el = root.querySelector<HTMLElement>(
      ".workspace-shell__load-character-dialog",
    );
    if (!el) throw new Error("dialog not found");
    return el;
  }

  function dialogPicker(root: HTMLElement): HTMLInputElement {
    const input =
      dialog(root).querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("dialog folder picker not found");
    return input;
  }

  async function pickFolder(root: HTMLElement, files: File[]): Promise<void> {
    const input = dialogPicker(root);
    Object.defineProperty(input, "files", { value: files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    // Let the (possibly async) folder-load pipeline settle at least one tick.
    await vi.waitFor(() => {
      const stillReading = dialog(root)
        .querySelector('[role="status"]')
        ?.textContent?.toLowerCase()
        .includes("reading");
      if (stillReading) throw new Error("still loading");
    });
  }

  async function realTabButton(
    root: HTMLElement,
    index: number,
  ): Promise<HTMLButtonElement> {
    await vi.waitFor(() => {
      const tabs = root.querySelector("wuik-tabs");
      const button =
        tabs?.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[
          index
        ];
      if (!button) throw new Error(`tab button ${index} not ready`);
    });
    const tabs = root.querySelector("wuik-tabs");
    return tabs?.shadowRoot?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    )[index] as HTMLButtonElement;
  }

  function panels(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>("wuik-tab-panel"));
  }

  beforeEach(() => {
    resetWasmBridgeForTests();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("opens a dialog with an empty folder-input widget, without hiding or resetting the currently loaded character underneath", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderWorkspaceShell(root, "0.1.0", character(), sffBytes, {
      bridgeOptions: testOptions,
    });

    expect(dialog(root).hasAttribute("open")).toBe(false);

    loadCharacterButton(root).click();

    expect(dialog(root).hasAttribute("open")).toBe(true);
    expect(dialogPicker(root)).not.toBeNull();
    // The underlying workspace is still there, untouched, behind the dialog.
    expect(root.querySelector('[slot="toolbar"]')?.textContent).toContain(
      "Ryu",
    );
    expect(root.querySelector(".characteristics-panel")).not.toBeNull();
  });

  it("replaces the character, resets every section's own state, but keeps the currently active sidebar section selected", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderWorkspaceShell(root, "0.1.0", character("Ryu"), sffBytes, {
      bridgeOptions: testOptions,
    });

    // Switch to Sprites and expand a group — state that must reset.
    (await realTabButton(root, 2)).click();
    await vi.waitFor(() =>
      expect(
        root
          .querySelector("wuik-tabs")
          ?.shadowRoot?.querySelector('[aria-selected="true"]')?.textContent,
      ).toBe("Sprites"),
    );
    root
      .querySelector<HTMLButtonElement>(".sprite-browser__group-toggle")
      ?.click();
    expect(
      root
        .querySelector(".sprite-browser__group-toggle")
        ?.getAttribute("aria-expanded"),
    ).toBe("true");

    loadCharacterButton(root).click();
    await pickFolder(root, completeFolderFiles("Switched Character"));

    await vi.waitFor(() =>
      expect(dialog(root).hasAttribute("open")).toBe(false),
    );

    expect(root.querySelector('[slot="toolbar"]')?.textContent).toContain(
      "Switched Character",
    );

    // Sprites is still the selected sidebar section...
    const sectionPanels = panels(root);
    expect(sectionPanels[2].hidden).toBe(false);
    expect(sectionPanels[0].hidden).toBe(true);

    // ...but its own state (the expanded group) has been rebuilt fresh —
    // the sprite browser now reflects the newly loaded character's own
    // sprite sheet, collapsed by default rather than reusing the old one's
    // expanded state.
    expect(
      root
        .querySelector(".sprite-browser__group-toggle")
        ?.getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("closing the dialog without completing a load discards the in-progress widget, leaving the original character untouched, and shows a fresh widget next time it opens", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderWorkspaceShell(root, "0.1.0", character("Ryu"), sffBytes, {
      bridgeOptions: testOptions,
    });

    loadCharacterButton(root).click();
    const input = dialogPicker(root);
    Object.defineProperty(input, "files", {
      value: twoDefCandidateFiles(),
      configurable: true,
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() =>
      expect(dialog(root).querySelector("fieldset")).not.toBeNull(),
    );

    // Close without completing (Esc, per <wuik-dialog>'s own contract).
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(dialog(root).hasAttribute("open")).toBe(false);

    // The original character is untouched.
    expect(root.querySelector('[slot="toolbar"]')?.textContent).toContain(
      "Ryu",
    );

    // Reopening shows a fresh, empty widget — not the leftover candidate picker.
    loadCharacterButton(root).click();
    expect(dialog(root).querySelector("fieldset")).toBeNull();
    expect(dialog(root).querySelector('[role="status"]')?.textContent).toBe("");
  });

  it("ignores a load that only succeeds after the dialog was already closed, never swapping the character out from under the user", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderWorkspaceShell(root, "0.1.0", character("Ryu"), sffBytes, {
      bridgeOptions: testOptions,
    });

    loadCharacterButton(root).click();
    const input = dialogPicker(root);
    Object.defineProperty(input, "files", {
      value: completeFolderFiles("Late Success Character"),
      configurable: true,
    });
    // Dispatch the (async) folder load, then close the dialog in the very
    // same tick — before the FileReader/WASM pipeline has any chance to
    // resolve — simulating a user who dismisses the popup while a pick is
    // still being validated.
    input.dispatchEvent(new Event("change", { bubbles: true }));
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(dialog(root).hasAttribute("open")).toBe(false);

    // Give the real WASM pipeline plenty of time to actually finish.
    await new Promise((resolve) => setTimeout(resolve, 500));

    // The late success must have been ignored entirely — the *displayed*
    // character name (not the now-orphaned dialog widget's own leftover
    // status text) is what actually matters here.
    expect(dialog(root).hasAttribute("open")).toBe(false);
    expect(
      root.querySelector(".workspace-shell__character-name")?.textContent,
    ).toBe("Ryu");
  });

  it("does nothing if the toolbar button is clicked again while the dialog is already open, rather than restarting the widget", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderWorkspaceShell(root, "0.1.0", character("Ryu"), sffBytes, {
      bridgeOptions: testOptions,
    });

    loadCharacterButton(root).click();
    const firstWidget = dialog(root).querySelector(".file-input");
    loadCharacterButton(root).click();

    expect(dialog(root).querySelector(".file-input")).toBe(firstWidget);
  });

  it("a failed load in the popup shows the error there and leaves the original character and every section's state completely intact", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderWorkspaceShell(root, "0.1.0", character("Ryu"), sffBytes, {
      bridgeOptions: testOptions,
    });

    (await realTabButton(root, 2)).click(); // Sprites
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

    loadCharacterButton(root).click();
    await pickFolder(root, folderMissingCns("Broken Character"));

    await vi.waitFor(() =>
      expect(
        dialog(root).querySelector(".file-input__status--error"),
      ).not.toBeNull(),
    );

    // The dialog stays open, showing the error...
    expect(dialog(root).hasAttribute("open")).toBe(true);
    // ...and the original character/workspace is completely unaffected.
    expect(root.querySelector('[slot="toolbar"]')?.textContent).toContain(
      "Ryu",
    );
    expect(
      root
        .querySelector(".sprite-browser__group-toggle")
        ?.getAttribute("aria-expanded"),
    ).toBe("true");
  });
});
