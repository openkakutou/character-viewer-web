import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpritePixelResult } from "../wasm/bridge.ts";
import type { Animation, CharacterData, Frame, Sprite } from "../wasm/types.ts";
import {
  buildGifFilename,
  compositeFrameRgba,
  computeGifCanvasLayout,
  encodeAnimationGif,
  renderGifExportControls,
  resolveStandAnimation,
  sanitizeForFilename,
} from "./gif-export.ts";

function frame(overrides: Partial<Frame> = {}): Frame {
  return {
    group: 0,
    image: 0,
    x: 0,
    y: 0,
    time: 5,
    flip: "",
    blend: "",
    clsn1: [],
    clsn2: [],
    ...overrides,
  };
}

function sprite(overrides: Partial<Sprite> = {}): Sprite {
  return {
    group: 0,
    image: 0,
    width: 10,
    height: 10,
    axisX: 5,
    axisY: 8,
    palette: 0,
    ...overrides,
  };
}

function character(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    name: "Test Character",
    author: "",
    animations: [],
    sprites: [],
    stateDefs: [],
    palettes: [],
    spriteFile: "",
    animationFile: "",
    soundFile: "",
    commandFile: "",
    constantsFile: "",
    stateFiles: [],
    ...overrides,
  };
}

describe("sanitizeForFilename", () => {
  it("lowercases and replaces non-alphanumeric runs with a single dash", () => {
    expect(sanitizeForFilename("Ky Kiske!!")).toBe("ky-kiske");
  });

  it("trims leading/trailing dashes produced by leading/trailing punctuation", () => {
    expect(sanitizeForFilename("--Ky--")).toBe("ky");
  });

  it("falls back to 'character' when nothing alphanumeric remains", () => {
    expect(sanitizeForFilename("!!!")).toBe("character");
  });
});

describe("buildGifFilename", () => {
  it("combines the sanitized character name and label with a .gif extension", () => {
    expect(buildGifFilename("Ky Kiske", "anim0")).toBe("ky-kiske-anim0.gif");
  });
});

describe("resolveStandAnimation", () => {
  it("returns the Animation numbered 0 when present", () => {
    const stand: Animation = { number: 0, frames: [frame()], loopStart: 0 };
    const other: Animation = { number: 200, frames: [frame()], loopStart: 0 };
    expect(
      resolveStandAnimation(character({ animations: [other, stand] })),
    ).toBe(stand);
  });

  it("returns null when no Animation numbered 0 exists", () => {
    const other: Animation = { number: 200, frames: [frame()], loopStart: 0 };
    expect(
      resolveStandAnimation(character({ animations: [other] })),
    ).toBeNull();
  });

  it("returns null when the character has no animations at all", () => {
    expect(resolveStandAnimation(character({ animations: [] }))).toBeNull();
  });
});

describe("computeGifCanvasLayout", () => {
  it("sizes the canvas to a single frame's sprite bounding box", () => {
    const spriteByKey = new Map([
      ["0,0", sprite({ width: 10, height: 10, axisX: 5, axisY: 8 })],
    ]);
    const layout = computeGifCanvasLayout(
      [frame({ group: 0, image: 0 })],
      spriteByKey,
    );
    // bbox: left=-5, top=-8, right=5, bottom=2 -> width=10, height=10
    expect(layout.width).toBe(10);
    expect(layout.height).toBe(10);
    expect(layout.frameOffsets).toEqual([{ x: 0, y: 0 }]);
  });

  it("unions bounding boxes of differently sized sprites, axis-aligned", () => {
    // Frame A: 10x10, axis (5,8) -> bbox [-5,-8,5,2]
    // Frame B: 20x10, axis (10,8) -> bbox [-10,-8,10,2]
    // Union: [-10,-8,10,2] -> width=20, height=10
    const spriteByKey = new Map<string, Sprite>([
      [
        "0,0",
        sprite({
          group: 0,
          image: 0,
          width: 10,
          height: 10,
          axisX: 5,
          axisY: 8,
        }),
      ],
      [
        "0,1",
        sprite({
          group: 0,
          image: 1,
          width: 20,
          height: 10,
          axisX: 10,
          axisY: 8,
        }),
      ],
    ]);
    const layout = computeGifCanvasLayout(
      [frame({ group: 0, image: 0 }), frame({ group: 0, image: 1 })],
      spriteByKey,
    );
    expect(layout.width).toBe(20);
    expect(layout.height).toBe(10);
    // originX = 10 (=-minLeft), originY = 8 (=-minTop)
    // Frame A offset: (10-5, 8-8) = (5, 0)
    // Frame B offset: (10-10, 8-8) = (0, 0)
    expect(layout.frameOffsets).toEqual([
      { x: 5, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it("gives a blank frame a null offset and excludes it from the bounding box", () => {
    const spriteByKey = new Map([
      ["0,0", sprite({ width: 10, height: 10, axisX: 5, axisY: 8 })],
    ]);
    const layout = computeGifCanvasLayout(
      [frame({ group: 0, image: 0 }), frame({ group: -1, image: -1 })],
      spriteByKey,
    );
    expect(layout.frameOffsets).toEqual([{ x: 0, y: 0 }, null]);
    expect(layout.width).toBe(10); // unaffected by the blank frame
  });

  it("falls back to a 1x1 canvas when every frame is blank", () => {
    const layout = computeGifCanvasLayout(
      [frame({ group: -1, image: -1 })],
      new Map(),
    );
    expect(layout.width).toBe(1);
    expect(layout.height).toBe(1);
    expect(layout.frameOffsets).toEqual([null]);
  });

  it("treats a frame referencing a sprite absent from the map as blank (malformed data)", () => {
    const layout = computeGifCanvasLayout(
      [frame({ group: 9, image: 9 })],
      new Map(),
    );
    expect(layout.frameOffsets).toEqual([null]);
  });
});

describe("compositeFrameRgba", () => {
  it("places the sprite's pixels at the given offset on a larger transparent canvas", () => {
    // 1x1 opaque red pixel, placed at (1,1) on a 3x3 canvas.
    const pixels = new Uint8Array([255, 0, 0, 255]);
    const result = compositeFrameRgba(pixels, 1, 1, 3, 3, 1, 1);
    expect(result.length).toBe(3 * 3 * 4);
    // Center pixel (1,1) -> index (1*3+1)*4 = 16
    expect(Array.from(result.slice(16, 20))).toEqual([255, 0, 0, 255]);
    // A corner pixel (0,0) stays fully transparent.
    expect(Array.from(result.slice(0, 4))).toEqual([0, 0, 0, 0]);
  });

  it("clips pixels that would land outside the canvas instead of throwing", () => {
    const pixels = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]); // 2x1
    expect(() => compositeFrameRgba(pixels, 2, 1, 1, 1, 0, 0)).not.toThrow();
    const result = compositeFrameRgba(pixels, 2, 1, 1, 1, 0, 0);
    // Only the in-bounds (0,0) source pixel is drawn; the second is clipped.
    expect(Array.from(result)).toEqual([10, 20, 30, 255]);
  });

  it("leaves the whole canvas transparent when fully offset outside its bounds", () => {
    const pixels = new Uint8Array([255, 255, 255, 255]);
    const result = compositeFrameRgba(pixels, 1, 1, 2, 2, 5, 5);
    expect(Array.from(result)).toEqual(new Array(16).fill(0));
  });

  it("zeroes a fully-transparent source pixel's RGB regardless of its original color", () => {
    // A pixel with real color data but zero alpha (e.g. sprite anti-aliasing
    // remnants, or any arbitrary "don't care" color behind a transparent
    // area). Found via real-tool (Pillow) runtime verification: gifenc's
    // `applyPalette` matches nearest color on the raw RGBA buffer with no
    // alpha-aware clearing of its own, so an uncleared (0,255,0,0) pixel can
    // tie-distance between a palette's transparent (0,0,0,0) entry and an
    // unrelated opaque (0,255,0,255) one, and lose the tie — rendering as
    // visibly green instead of transparent.
    const pixels = new Uint8Array([0, 255, 0, 0]);
    const result = compositeFrameRgba(pixels, 1, 1, 1, 1, 0, 0);
    expect(Array.from(result)).toEqual([0, 0, 0, 0]);
  });
});

const sffBytes = new Uint8Array([9, 9, 9]);

function okResult(
  width: number,
  height: number,
  fillOpaque = true,
): SpritePixelResult {
  const pixels = new Uint8Array(width * height * 4);
  if (fillOpaque) {
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 200;
      pixels[i + 1] = 100;
      pixels[i + 2] = 50;
      pixels[i + 3] = 255;
    }
  }
  return { ok: true, pixels, width, height };
}

describe("encodeAnimationGif", () => {
  it("errors on an animation with no frames instead of producing an empty file", async () => {
    const anim: Animation = { number: 0, frames: [], loopStart: 0 };
    const result = await encodeAnimationGif(sffBytes, character(), anim, null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/no frames/i);
    }
  });

  it("produces a valid GIF89a byte stream for a simple animation", async () => {
    const anim: Animation = {
      number: 0,
      frames: [frame({ time: 4 }), frame({ time: 8 })],
      loopStart: 0,
    };
    const resolveSpritePixels = vi.fn(async () => [okResult(4, 4)]);
    const result = await encodeAnimationGif(
      sffBytes,
      character({
        sprites: [{ index: 0, sprites: [sprite({ width: 4, height: 4 })] }],
      }),
      anim,
      null,
      { resolveSpritePixels },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const header = new TextDecoder().decode(result.bytes.slice(0, 6));
      expect(header).toBe("GIF89a");
      expect(result.bytes.at(-1)).toBe(0x3b); // GIF trailer byte
    }
  });

  it("deduplicates repeated (group,image) sprite requests across frames", async () => {
    const anim: Animation = {
      number: 0,
      frames: [
        frame({ group: 0, image: 0 }),
        frame({ group: 0, image: 0 }),
        frame({ group: 0, image: 0 }),
      ],
      loopStart: 0,
    };
    const resolveSpritePixels = vi.fn(async (_sff, requests) =>
      requests.map(() => okResult(2, 2)),
    );
    await encodeAnimationGif(
      sffBytes,
      character({
        sprites: [{ index: 0, sprites: [sprite({ width: 2, height: 2 })] }],
      }),
      anim,
      null,
      { resolveSpritePixels },
    );
    expect(resolveSpritePixels).toHaveBeenCalledTimes(1);
    const requests = resolveSpritePixels.mock.calls[0][1];
    expect(requests).toEqual([[0, 0]]);
  });

  it("forwards the given palette override to the sprite resolver", async () => {
    const anim: Animation = { number: 0, frames: [frame()], loopStart: 0 };
    const resolveSpritePixels = vi.fn(async () => [okResult(2, 2)]);
    const override = new Uint8Array([1, 2, 3]);
    await encodeAnimationGif(
      sffBytes,
      character({
        sprites: [{ index: 0, sprites: [sprite({ width: 2, height: 2 })] }],
      }),
      anim,
      override,
      { resolveSpritePixels },
    );
    expect(resolveSpritePixels).toHaveBeenCalledWith(
      sffBytes,
      expect.anything(),
      override,
      undefined,
    );
  });

  it("succeeds with a transparent frame when a frame is blank, without attempting to decode it", async () => {
    const anim: Animation = {
      number: 0,
      frames: [frame({ group: -1, image: -1 })],
      loopStart: 0,
    };
    const resolveSpritePixels = vi.fn(async () => []);
    const result = await encodeAnimationGif(sffBytes, character(), anim, null, {
      resolveSpritePixels,
    });
    expect(result.ok).toBe(true);
    expect(resolveSpritePixels).not.toHaveBeenCalled();
  });

  it("returns a clear error instead of a broken file when sprite resolution fails", async () => {
    const anim: Animation = { number: 0, frames: [frame()], loopStart: 0 };
    const resolveSpritePixels = vi.fn(async () => [
      {
        ok: false,
        error: "decode failed: corrupt sprite",
      } as SpritePixelResult,
    ]);
    const result = await encodeAnimationGif(
      sffBytes,
      character({
        sprites: [{ index: 0, sprites: [sprite({ width: 2, height: 2 })] }],
      }),
      anim,
      null,
      { resolveSpritePixels },
    );
    expect(result).toEqual({
      ok: false,
      error: "decode failed: corrupt sprite",
    });
  });
});

describe("renderGifExportControls", () => {
  const anim3: Animation = {
    number: 3,
    frames: [frame({ time: 4 })],
    loopStart: 0,
  };
  const stand: Animation = {
    number: 0,
    frames: [frame({ time: 4 })],
    loopStart: 0,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports the animation returned by getCurrentAnimation when 'Export GIF' is clicked", async () => {
    const root = document.createElement("div");
    const encodeAnimationGif = vi
      .fn()
      .mockResolvedValue({ ok: true, bytes: new Uint8Array([1]) });
    const triggerDownload = vi.fn();

    renderGifExportControls(
      root,
      character({ name: "Kung Fu Man", animations: [anim3] }),
      sffBytes,
      () => anim3,
      () => null,
      { encodeAnimationGif, triggerDownload },
    );

    const exportButton = root.querySelector<HTMLButtonElement>(
      ".animation-player__export-gif",
    );
    exportButton?.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(encodeAnimationGif).toHaveBeenCalledWith(
      sffBytes,
      expect.objectContaining({ name: "Kung Fu Man" }),
      anim3,
      null,
      expect.anything(),
    );
    expect(triggerDownload).toHaveBeenCalledWith(
      new Uint8Array([1]),
      "kung-fu-man-anim3.gif",
    );
  });

  it("exports Animation 0 when 'Export Stand' is clicked, regardless of the current selection", async () => {
    const root = document.createElement("div");
    const encodeAnimationGif = vi
      .fn()
      .mockResolvedValue({ ok: true, bytes: new Uint8Array([2]) });
    const triggerDownload = vi.fn();

    renderGifExportControls(
      root,
      character({ name: "Kung Fu Man", animations: [anim3, stand] }),
      sffBytes,
      () => anim3, // currently selected animation is #3, not Stand
      () => null,
      { encodeAnimationGif, triggerDownload },
    );

    const standButton = root.querySelector<HTMLButtonElement>(
      ".animation-player__export-stand",
    );
    standButton?.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(encodeAnimationGif).toHaveBeenCalledWith(
      sffBytes,
      expect.anything(),
      stand,
      null,
      expect.anything(),
    );
    expect(triggerDownload).toHaveBeenCalledWith(
      new Uint8Array([2]),
      "kung-fu-man-stand.gif",
    );
  });

  it("shows a clear error and never downloads when Export Stand has no Animation 0 to export", async () => {
    const root = document.createElement("div");
    const encodeAnimationGif = vi.fn();
    const triggerDownload = vi.fn();

    renderGifExportControls(
      root,
      character({ name: "Kung Fu Man", animations: [anim3] }), // no Animation 0
      sffBytes,
      () => anim3,
      () => null,
      { encodeAnimationGif, triggerDownload },
    );

    const standButton = root.querySelector<HTMLButtonElement>(
      ".animation-player__export-stand",
    );
    standButton?.click();

    expect(encodeAnimationGif).not.toHaveBeenCalled();
    expect(triggerDownload).not.toHaveBeenCalled();
    const status = root.querySelector(".animation-player__export-status");
    expect(status?.textContent).toMatch(/no.*stand.*animation/i);
    expect(status?.className).toContain("--error");
  });

  it("shows the encode error and does not download when encoding fails", async () => {
    const root = document.createElement("div");
    const encodeAnimationGif = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "sprite decode failed" });
    const triggerDownload = vi.fn();

    renderGifExportControls(
      root,
      character({ name: "Kung Fu Man", animations: [anim3] }),
      sffBytes,
      () => anim3,
      () => null,
      { encodeAnimationGif, triggerDownload },
    );

    root
      .querySelector<HTMLButtonElement>(".animation-player__export-gif")
      ?.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(triggerDownload).not.toHaveBeenCalled();
    const status = root.querySelector(".animation-player__export-status");
    expect(status?.textContent).toBe("sprite decode failed");
    expect(status?.className).toContain("--error");
  });

  it("disables both buttons while an export is in flight and re-enables them once done", async () => {
    const root = document.createElement("div");
    let resolveEncode: (value: { ok: true; bytes: Uint8Array }) => void =
      () => {};
    const encodeAnimationGif = vi.fn(
      () =>
        new Promise<{ ok: true; bytes: Uint8Array }>((resolve) => {
          resolveEncode = resolve;
        }),
    );
    const triggerDownload = vi.fn();

    renderGifExportControls(
      root,
      character({ name: "Kung Fu Man", animations: [anim3] }),
      sffBytes,
      () => anim3,
      () => null,
      { encodeAnimationGif, triggerDownload },
    );

    const exportButton = root.querySelector<HTMLButtonElement>(
      ".animation-player__export-gif",
    );
    const standButton = root.querySelector<HTMLButtonElement>(
      ".animation-player__export-stand",
    );
    exportButton?.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(exportButton?.disabled).toBe(true);
    expect(standButton?.disabled).toBe(true);

    resolveEncode({ ok: true, bytes: new Uint8Array([1]) });
    await vi.advanceTimersByTimeAsync(0);

    expect(exportButton?.disabled).toBe(false);
    expect(standButton?.disabled).toBe(false);
  });
});
