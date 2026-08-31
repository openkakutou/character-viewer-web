import { describe, expect, it, vi } from "vitest";
import type { SpritePixelResult } from "../wasm/bridge.ts";
import type { CharacterData } from "../wasm/types.ts";
import { renderPalettePicker } from "./palette-picker.ts";

function fixtureCharacter(
  overrides: Partial<CharacterData> = {},
): CharacterData {
  return {
    name: "Kung Fu Man",
    animations: [],
    sprites: [
      {
        index: 0,
        sprites: [
          {
            group: 0,
            image: 0,
            width: 100,
            height: 200,
            axisX: 50,
            axisY: 190,
            palette: 0,
          },
        ],
      },
    ],
    stateDefs: [],
    palettes: [],
    ...overrides,
  };
}

const sffBytes = new Uint8Array([1, 2, 3]);

function pickFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function actFile(name = "custom.act"): File {
  return new File([new Uint8Array(768)], name);
}

function okPixels(): SpritePixelResult {
  return { ok: true, pixels: new Uint8Array(4), width: 1, height: 1 };
}

function need<T>(el: T | null, what: string): T {
  if (!el) throw new Error(`${what} not found`);
  return el;
}

function status(root: HTMLElement): HTMLElement {
  return need(
    root.querySelector<HTMLElement>(".palette-picker__status"),
    "status",
  );
}

function resetButton(root: HTMLElement): HTMLButtonElement {
  return need(
    root.querySelector<HTMLButtonElement>('[data-action="reset-palette"]'),
    "reset button",
  );
}

function uploadInput(root: HTMLElement): HTMLInputElement {
  return need(
    root.querySelector<HTMLInputElement>(".palette-picker__upload-input"),
    "upload input",
  );
}

describe("renderPalettePicker", () => {
  it("renders nothing when no character is loaded", () => {
    const root = document.createElement("div");
    renderPalettePicker(root, null, null, { onPaletteChange: vi.fn() });
    expect(root.children).toHaveLength(0);
  });

  it("lists the character's referenced palette files as informational text", () => {
    const root = document.createElement("div");
    renderPalettePicker(
      root,
      fixtureCharacter({ palettes: ["kfm1.act", "kfm2.act"] }),
      sffBytes,
      { onPaletteChange: vi.fn() },
    );
    expect(root.textContent).toContain("2 palette files");
    expect(root.textContent).toContain("kfm1.act, kfm2.act");
  });

  it("shows an explicit empty state when the character references no palette files", () => {
    const root = document.createElement("div");
    renderPalettePicker(root, fixtureCharacter({ palettes: [] }), sffBytes, {
      onPaletteChange: vi.fn(),
    });
    expect(root.textContent).toContain("references no external palette files");
  });

  it("starts with the reset button disabled and the default-palette status", () => {
    const root = document.createElement("div");
    renderPalettePicker(root, fixtureCharacter(), sffBytes, {
      onPaletteChange: vi.fn(),
    });
    expect(resetButton(root).hasAttribute("disabled")).toBe(true);
    expect(status(root).textContent).toContain("own palette");
  });

  it("probe-validates an uploaded file, then applies it and shows it as active", async () => {
    const onPaletteChange = vi.fn();
    const resolveSpritePixels = vi.fn().mockResolvedValue([okPixels()]);
    const readFileBytes = vi.fn().mockResolvedValue(new Uint8Array(768));
    const root = document.createElement("div");
    renderPalettePicker(root, fixtureCharacter(), sffBytes, {
      onPaletteChange,
      readFileBytes,
      resolveSpritePixels,
    });

    pickFile(uploadInput(root), actFile("kfm1.act"));
    await vi.waitFor(() => {
      expect(onPaletteChange).toHaveBeenCalled();
    });

    expect(resolveSpritePixels).toHaveBeenCalledWith(
      sffBytes,
      [[0, 0]],
      expect.any(Uint8Array),
      undefined,
    );
    expect(onPaletteChange).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(status(root).textContent).toContain("kfm1.act");
    expect(resetButton(root).hasAttribute("disabled")).toBe(false);
  });

  it("shows the bridge's own error for an invalid/wrong-sized .act file, and does not apply it", async () => {
    const onPaletteChange = vi.fn();
    const resolveSpritePixels = vi.fn().mockResolvedValue([
      {
        ok: false,
        error: "sff: external .act palette is 3 bytes, want exactly 768",
      },
    ]);
    const root = document.createElement("div");
    renderPalettePicker(root, fixtureCharacter(), sffBytes, {
      onPaletteChange,
      readFileBytes: vi.fn().mockResolvedValue(new Uint8Array(3)),
      resolveSpritePixels,
    });

    pickFile(uploadInput(root), actFile("bad.act"));
    await vi.waitFor(() => {
      expect(status(root).textContent).toContain("768");
    });

    expect(onPaletteChange).not.toHaveBeenCalled();
    expect(resetButton(root).hasAttribute("disabled")).toBe(true);
  });

  it("keeps a previously active override unchanged when a later upload fails validation", async () => {
    const onPaletteChange = vi.fn();
    const resolveSpritePixels = vi
      .fn()
      .mockResolvedValueOnce([okPixels()])
      .mockResolvedValueOnce([{ ok: false, error: "not a valid palette" }]);
    const root = document.createElement("div");
    renderPalettePicker(root, fixtureCharacter(), sffBytes, {
      onPaletteChange,
      readFileBytes: vi.fn().mockResolvedValue(new Uint8Array(768)),
      resolveSpritePixels,
    });

    pickFile(uploadInput(root), actFile("good.act"));
    await vi.waitFor(() =>
      expect(status(root).textContent).toContain("good.act"),
    );

    pickFile(uploadInput(root), actFile("bad.act"));
    await vi.waitFor(() =>
      expect(status(root).textContent).toContain("not a valid palette"),
    );

    // still shows the last *applied* override, not the failed one
    expect(onPaletteChange).toHaveBeenCalledTimes(1);
    expect(resetButton(root).hasAttribute("disabled")).toBe(false);
  });

  it("resets to the character's own palette on demand", async () => {
    const onPaletteChange = vi.fn();
    const root = document.createElement("div");
    renderPalettePicker(root, fixtureCharacter(), sffBytes, {
      onPaletteChange,
      readFileBytes: vi.fn().mockResolvedValue(new Uint8Array(768)),
      resolveSpritePixels: vi.fn().mockResolvedValue([okPixels()]),
    });

    pickFile(uploadInput(root), actFile("kfm1.act"));
    await vi.waitFor(() =>
      expect(resetButton(root).hasAttribute("disabled")).toBe(false),
    );

    resetButton(root).click();
    expect(onPaletteChange).toHaveBeenLastCalledWith(null);
    expect(resetButton(root).hasAttribute("disabled")).toBe(true);
    expect(status(root).textContent).toContain("own palette");
  });

  it("accepts an upload optimistically (no probe) when the character has no sprites to validate against", async () => {
    const onPaletteChange = vi.fn();
    const resolveSpritePixels = vi.fn();
    const root = document.createElement("div");
    renderPalettePicker(root, fixtureCharacter({ sprites: [] }), sffBytes, {
      onPaletteChange,
      readFileBytes: vi.fn().mockResolvedValue(new Uint8Array(768)),
      resolveSpritePixels,
    });

    pickFile(uploadInput(root), actFile("kfm1.act"));
    await vi.waitFor(() => expect(onPaletteChange).toHaveBeenCalled());

    expect(resolveSpritePixels).not.toHaveBeenCalled();
  });

  it("re-probes and re-applies when the same file is uploaded a second time", async () => {
    const onPaletteChange = vi.fn();
    const resolveSpritePixels = vi.fn().mockResolvedValue([okPixels()]);
    const root = document.createElement("div");
    renderPalettePicker(root, fixtureCharacter(), sffBytes, {
      onPaletteChange,
      readFileBytes: vi.fn().mockResolvedValue(new Uint8Array(768)),
      resolveSpritePixels,
    });

    const file = actFile("kfm1.act");
    pickFile(uploadInput(root), file);
    await vi.waitFor(() => expect(onPaletteChange).toHaveBeenCalledTimes(1));

    pickFile(uploadInput(root), file);
    await vi.waitFor(() => expect(onPaletteChange).toHaveBeenCalledTimes(2));
  });
});
