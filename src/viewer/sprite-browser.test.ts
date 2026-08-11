import { describe, expect, it, vi } from "vitest";
import type { SpritePixelResult } from "../wasm/bridge.ts";
import type { CharacterData } from "../wasm/types.ts";
import { computeScaleToFit, renderSpriteBrowser } from "./sprite-browser.ts";

function characterWithSprites(): CharacterData {
  return {
    name: "Test",
    animations: [],
    sprites: [
      {
        index: 0,
        sprites: [
          {
            group: 0,
            image: 0,
            width: 57,
            height: 103,
            axisX: 25,
            axisY: 99,
            palette: 0,
          },
          {
            group: 0,
            image: 1,
            width: 20,
            height: 20,
            axisX: 10,
            axisY: 10,
            palette: 0,
          },
        ],
      },
      {
        index: 1,
        sprites: [
          {
            group: 1,
            image: 0,
            width: 300,
            height: 400,
            axisX: 0,
            axisY: 0,
            palette: 0,
          },
        ],
      },
    ],
    stateDefs: [],
  };
}

const sffBytes = new Uint8Array([1, 2, 3]);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("renderSpriteBrowser", () => {
  it("renders nothing when no character is loaded", () => {
    const root = document.createElement("div");
    renderSpriteBrowser(root, null, null);
    expect(root.children).toHaveLength(0);
  });

  it("shows an explicit empty state for a character with no sprites", () => {
    const root = document.createElement("div");
    const character: CharacterData = {
      name: "Empty",
      animations: [],
      sprites: [],
      stateDefs: [],
    };
    renderSpriteBrowser(root, character, sffBytes);
    expect(root.textContent).toContain("No sprites");
  });

  it("lists sprite groups collapsed by default, with no per-sprite rows mounted yet", () => {
    const root = document.createElement("div");
    renderSpriteBrowser(root, characterWithSprites(), sffBytes);

    const groupButtons = root.querySelectorAll(".sprite-browser__group-toggle");
    expect(groupButtons).toHaveLength(2);
    const spriteButtons = root.querySelectorAll(".sprite-browser__sprite");
    expect(spriteButtons).toHaveLength(0);
  });

  it("expands a group's sprites only once its toggle is clicked", () => {
    const root = document.createElement("div");
    renderSpriteBrowser(root, characterWithSprites(), sffBytes);

    const firstGroupToggle = root.querySelectorAll<HTMLButtonElement>(
      ".sprite-browser__group-toggle",
    )[0];
    firstGroupToggle.click();

    const spriteButtons = root.querySelectorAll(".sprite-browser__sprite");
    expect(spriteButtons).toHaveLength(2);
    expect(spriteButtons[0].textContent).toContain("0");
    expect(spriteButtons[1].textContent).toContain("1");
  });

  it("decodes and draws the selected sprite's pixels, marking it selected", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [
        {
          ok: true,
          pixels: new Uint8Array(57 * 103 * 4),
          width: 57,
          height: 103,
        },
      ],
    );
    renderSpriteBrowser(root, characterWithSprites(), sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    root
      .querySelectorAll<HTMLButtonElement>(".sprite-browser__group-toggle")[0]
      .click();
    const spriteButton = root.querySelectorAll<HTMLButtonElement>(
      ".sprite-browser__sprite",
    )[0];
    spriteButton.click();

    await vi.waitFor(() => {
      expect(drawPixels).toHaveBeenCalledTimes(1);
    });

    expect(resolveSpritePixels).toHaveBeenCalledWith(
      sffBytes,
      [[0, 0]],
      null,
      undefined,
    );
    const [canvasArg, pixelsArg, widthArg, heightArg] =
      drawPixels.mock.calls[0];
    expect(canvasArg).toBeInstanceOf(HTMLCanvasElement);
    expect(widthArg).toBe(57);
    expect(heightArg).toBe(103);
    expect(pixelsArg).toBeInstanceOf(Uint8Array);

    expect(spriteButton.getAttribute("aria-current")).toBe("true");
  });

  it("shows a clear error placeholder instead of a broken image for an unsupported/corrupt sprite", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [
        { ok: false, error: "unsupported pixel format" },
      ],
    );
    renderSpriteBrowser(root, characterWithSprites(), sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    root
      .querySelectorAll<HTMLButtonElement>(".sprite-browser__group-toggle")[0]
      .click();
    root
      .querySelectorAll<HTMLButtonElement>(".sprite-browser__sprite")[0]
      .click();

    await vi.waitFor(() => {
      expect(root.textContent).toContain("unsupported pixel format");
    });
    expect(drawPixels).not.toHaveBeenCalled();
  });

  it("discards a slower, superseded decode instead of overwriting a newer selection", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const first = deferred<SpritePixelResult[]>();
    const second = deferred<SpritePixelResult[]>();
    const calls: number[] = [];
    const resolveSpritePixels = vi.fn(async () => {
      calls.push(calls.length);
      return calls.length === 1 ? first.promise : second.promise;
    });

    renderSpriteBrowser(root, characterWithSprites(), sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });
    root
      .querySelectorAll<HTMLButtonElement>(".sprite-browser__group-toggle")[0]
      .click();
    const [spriteA, spriteB] = root.querySelectorAll<HTMLButtonElement>(
      ".sprite-browser__sprite",
    );

    spriteA.click();
    spriteB.click();

    // B's (second, faster) response resolves first.
    second.resolve([
      { ok: true, pixels: new Uint8Array(20 * 20 * 4), width: 20, height: 20 },
    ]);
    await vi.waitFor(() => {
      expect(drawPixels).toHaveBeenCalledTimes(1);
    });

    // A's (first, slower) response resolves after — must be discarded since
    // B is the current selection.
    first.resolve([
      {
        ok: true,
        pixels: new Uint8Array(57 * 103 * 4),
        width: 57,
        height: 103,
      },
    ]);
    await Promise.resolve();
    await Promise.resolve();

    expect(drawPixels).toHaveBeenCalledTimes(1);
    expect(drawPixels.mock.calls[0][2]).toBe(20);
  });

  it("shows a loading indicator while a decode is in flight", async () => {
    const root = document.createElement("div");
    const pending = deferred<SpritePixelResult[]>();
    const resolveSpritePixels = vi.fn(async () => pending.promise);

    renderSpriteBrowser(root, characterWithSprites(), sffBytes, {
      resolveSpritePixels,
      drawPixels: vi.fn(),
    });
    root
      .querySelectorAll<HTMLButtonElement>(".sprite-browser__group-toggle")[0]
      .click();
    root
      .querySelectorAll<HTMLButtonElement>(".sprite-browser__sprite")[0]
      .click();

    expect(root.textContent).toContain("Loading");

    pending.resolve([
      {
        ok: true,
        pixels: new Uint8Array(57 * 103 * 4),
        width: 57,
        height: 103,
      },
    ]);
    await Promise.resolve();
  });

  it("replaces all previous content and state when called again with a different character", () => {
    const root = document.createElement("div");
    renderSpriteBrowser(root, characterWithSprites(), sffBytes);
    renderSpriteBrowser(root, null, null);
    expect(root.children).toHaveLength(0);
  });
});

describe("computeScaleToFit", () => {
  it("upscales a tiny sprite so it isn't visually indistinguishable from nothing loaded", () => {
    const scale = computeScaleToFit(4, 4);
    expect(scale).toBeGreaterThan(1);
  });

  it("downscales a very large sprite to fit the preview stage", () => {
    const scale = computeScaleToFit(300, 400);
    expect(scale).toBeLessThan(1);
    expect(scale * 400).toBeLessThanOrEqual(240);
  });

  it("never returns a non-finite or non-positive scale for a zero-size input", () => {
    const scale = computeScaleToFit(0, 0);
    expect(Number.isFinite(scale)).toBe(true);
    expect(scale).toBeGreaterThan(0);
  });

  it("caps the upscale factor instead of blowing up a 1px sprite arbitrarily large", () => {
    const scale = computeScaleToFit(1, 1);
    expect(scale).toBeLessThanOrEqual(8);
  });
});
