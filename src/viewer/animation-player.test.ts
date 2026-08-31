import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpritePixelResult } from "../wasm/bridge.ts";
import type {
  Animation,
  CharacterData,
  ClsnBox,
  Frame,
} from "../wasm/types.ts";
import {
  MS_PER_TICK,
  clampLoopStart,
  computeClsnRect,
  computeNextFrameIndex,
  effectiveTickDuration,
  isBlankFrame,
  renderAnimationPlayer,
} from "./animation-player.ts";

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

function characterWithAnimations(animations: Animation[]): CharacterData {
  return {
    name: "Test",
    animations,
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
    ],
    stateDefs: [],
    palettes: [],
  };
}

const sffBytes = new Uint8Array([1, 2, 3]);

function okResult(width: number, height: number): SpritePixelResult {
  return {
    ok: true,
    pixels: new Uint8Array(width * height * 4),
    width,
    height,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("effectiveTickDuration", () => {
  it("returns the frame's own time when positive", () => {
    expect(effectiveTickDuration(frame({ time: 10 }))).toBe(10);
  });

  it("clamps a zero time to a minimum 1-tick hold", () => {
    expect(effectiveTickDuration(frame({ time: 0 }))).toBe(1);
  });

  it("clamps MUGEN's 'hold forever' negative time to a minimum 1-tick hold", () => {
    expect(effectiveTickDuration(frame({ time: -1 }))).toBe(1);
  });

  it("clamps any other negative time the same way", () => {
    expect(effectiveTickDuration(frame({ time: -100 }))).toBe(1);
  });
});

describe("isBlankFrame", () => {
  it("is true for the -1,-1 blank sentinel", () => {
    expect(isBlankFrame(frame({ group: -1, image: -1 }))).toBe(true);
  });

  it("is true for any negative group value, not just -1", () => {
    expect(isBlankFrame(frame({ group: -1, image: 0 }))).toBe(true);
  });

  it("is true for any negative image value, not just -1", () => {
    expect(isBlankFrame(frame({ group: 0, image: -2 }))).toBe(true);
  });

  it("is false for a real, non-negative sprite reference", () => {
    expect(isBlankFrame(frame({ group: 0, image: 1 }))).toBe(false);
  });
});

describe("clampLoopStart", () => {
  it("keeps an in-range loopStart unchanged", () => {
    expect(clampLoopStart(2, 5)).toBe(2);
  });

  it("clamps a negative loopStart to 0", () => {
    expect(clampLoopStart(-1, 5)).toBe(0);
  });

  it("clamps an out-of-range loopStart to 0", () => {
    expect(clampLoopStart(10, 5)).toBe(0);
  });

  it("never returns a non-finite index for an empty frame list", () => {
    expect(clampLoopStart(0, 0)).toBe(0);
  });
});

describe("computeNextFrameIndex", () => {
  it("advances to the next frame when not at the end", () => {
    expect(computeNextFrameIndex(0, 3, 0, false)).toBe(1);
  });

  it("stops (returns null) at the last frame when not looping", () => {
    expect(computeNextFrameIndex(2, 3, 0, false)).toBeNull();
  });

  it("wraps back to loopStart at the last frame when looping", () => {
    expect(computeNextFrameIndex(2, 3, 1, true)).toBe(1);
  });

  it("wraps a single-frame animation back to itself when looping", () => {
    expect(computeNextFrameIndex(0, 1, 0, true)).toBe(0);
  });

  it("stops on a single-frame animation when not looping", () => {
    expect(computeNextFrameIndex(0, 1, 0, false)).toBeNull();
  });
});

describe("computeClsnRect", () => {
  it("offsets the box by the sprite's axis point, same pixel space as the image", () => {
    const box: ClsnBox = { left: -5, top: -10, right: 5, bottom: 0 };
    const rect = computeClsnRect(box, 8, 12);
    expect(rect).toEqual({ x: 3, y: 2, width: 10, height: 10 });
  });

  it("produces a zero-size rect for a degenerate box without throwing", () => {
    const box: ClsnBox = { left: 0, top: 0, right: 0, bottom: 0 };
    const rect = computeClsnRect(box, 0, 0);
    expect(rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("renderAnimationPlayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when no character is loaded", () => {
    const root = document.createElement("div");
    renderAnimationPlayer(root, null, null);
    expect(root.children).toHaveLength(0);
  });

  it("shows an explicit empty state for a character with no animations", () => {
    const root = document.createElement("div");
    const character = characterWithAnimations([]);
    renderAnimationPlayer(root, character, sffBytes);
    expect(root.textContent).toContain("No animations");
  });

  it("lists every animation number in the select", () => {
    const root = document.createElement("div");
    const character = characterWithAnimations([
      { number: 200, frames: [frame()], loopStart: 0 },
      { number: 100, frames: [frame()], loopStart: 0 },
    ]);
    renderAnimationPlayer(root, character, sffBytes);

    const select = root.querySelector<HTMLSelectElement>(
      ".animation-player__select",
    );
    const values = Array.from(select?.options ?? []).map((o) => o.value);
    expect(values).toEqual(["100", "200"]);
  });

  it("decodes and draws the first frame of the first animation by default", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(57, 103)],
    );
    const character = characterWithAnimations([
      {
        number: 0,
        frames: [frame({ group: 0, image: 0 }), frame({ group: 0, image: 1 })],
        loopStart: 0,
      },
    ]);
    renderAnimationPlayer(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    await vi.waitFor(() => {
      expect(drawPixels).toHaveBeenCalledTimes(1);
    });
    expect(resolveSpritePixels).toHaveBeenCalledWith(
      sffBytes,
      [[0, 0]],
      null,
      undefined,
    );
    expect(root.textContent).toContain("Frame 1 / 2");
  });

  it("renders a blank frame as empty with a distinct status, no decode attempted", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(57, 103)],
    );
    const character = characterWithAnimations([
      { number: 0, frames: [frame({ group: -1, image: -1 })], loopStart: 0 },
    ]);
    renderAnimationPlayer(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    await Promise.resolve();
    expect(resolveSpritePixels).not.toHaveBeenCalled();
    expect(drawPixels).not.toHaveBeenCalled();
    expect(root.textContent).toContain("Blank frame");
    const canvas = root.querySelector<HTMLCanvasElement>(
      ".animation-player__canvas",
    );
    expect(canvas?.hidden).toBe(true);
  });

  it("shows a clear error status instead of a broken image on decode failure", async () => {
    const root = document.createElement("div");
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [
        { ok: false, error: "unsupported pixel format" },
      ],
    );
    const character = characterWithAnimations([
      { number: 0, frames: [frame()], loopStart: 0 },
    ]);
    renderAnimationPlayer(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels: vi.fn(),
    });

    await vi.waitFor(() => {
      expect(root.textContent).toContain("unsupported pixel format");
    });
  });

  it("steps forward one frame at a time while paused", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWithAnimations([
      {
        number: 0,
        frames: [frame({ group: 0, image: 0 }), frame({ group: 0, image: 1 })],
        loopStart: 0,
      },
    ]);
    renderAnimationPlayer(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });
    await vi.waitFor(() => expect(drawPixels).toHaveBeenCalledTimes(1));

    const stepButton = root.querySelector<HTMLButtonElement>(
      ".animation-player__step",
    );
    stepButton?.click();

    await vi.waitFor(() => expect(drawPixels).toHaveBeenCalledTimes(2));
    expect(resolveSpritePixels).toHaveBeenLastCalledWith(
      sffBytes,
      [[0, 1]],
      null,
      undefined,
    );
    expect(root.textContent).toContain("Frame 2 / 2");
  });

  it("disables the step button while playing", async () => {
    const root = document.createElement("div");
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWithAnimations([
      { number: 0, frames: [frame(), frame()], loopStart: 0 },
    ]);
    renderAnimationPlayer(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels: vi.fn(),
    });
    await vi.waitFor(() =>
      expect(resolveSpritePixels).toHaveBeenCalledTimes(1),
    );

    const playButton = root.querySelector<HTMLButtonElement>(
      ".animation-player__play-pause",
    );
    const stepButton = root.querySelector<HTMLButtonElement>(
      ".animation-player__step",
    );
    expect(stepButton?.disabled).toBe(false);
    playButton?.click();
    expect(stepButton?.disabled).toBe(true);
    expect(playButton?.getAttribute("aria-pressed")).toBe("true");
    expect(playButton?.textContent).toContain("Pause");
  });

  it("advances frames automatically on Play, honoring each frame's own timing", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWithAnimations([
      {
        number: 0,
        frames: [
          frame({ group: 0, image: 0, time: 3 }),
          frame({ group: 0, image: 1, time: 5 }),
        ],
        loopStart: 0,
      },
    ]);
    renderAnimationPlayer(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });
    await vi.waitFor(() => expect(drawPixels).toHaveBeenCalledTimes(1));

    root
      .querySelector<HTMLButtonElement>(".animation-player__play-pause")
      ?.click();

    // Not yet elapsed: still on frame 1.
    await vi.advanceTimersByTimeAsync(3 * MS_PER_TICK - 1);
    expect(drawPixels).toHaveBeenCalledTimes(1);

    // Frame 1's hold elapses -> advances to frame 2.
    await vi.advanceTimersByTimeAsync(1);
    expect(drawPixels).toHaveBeenCalledTimes(2);
    expect(root.textContent).toContain("Frame 2 / 2");

    // Frame 2's hold elapses, not looping -> stops on the last frame.
    await vi.advanceTimersByTimeAsync(5 * MS_PER_TICK);
    expect(drawPixels).toHaveBeenCalledTimes(2);
    const playButton = root.querySelector<HTMLButtonElement>(
      ".animation-player__play-pause",
    );
    expect(playButton?.getAttribute("aria-pressed")).toBe("false");
    expect(playButton?.textContent).toContain("Play");
  });

  it("wraps back to loopStart when the loop checkbox is checked", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWithAnimations([
      {
        number: 0,
        frames: [
          frame({ group: 0, image: 0, time: 1 }),
          frame({ group: 0, image: 1, time: 1 }),
        ],
        loopStart: 1,
      },
    ]);
    renderAnimationPlayer(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });
    await vi.waitFor(() => expect(drawPixels).toHaveBeenCalledTimes(1));

    root.querySelector<HTMLInputElement>(".animation-player__loop")?.click();
    root
      .querySelector<HTMLButtonElement>(".animation-player__play-pause")
      ?.click();

    await vi.advanceTimersByTimeAsync(MS_PER_TICK); // -> frame 2
    await vi.advanceTimersByTimeAsync(MS_PER_TICK); // -> wraps to loopStart (frame 2, index 1)

    expect(root.textContent).toContain("Frame 2 / 2");
    const playButton = root.querySelector<HTMLButtonElement>(
      ".animation-player__play-pause",
    );
    expect(playButton?.getAttribute("aria-pressed")).toBe("true");
  });

  it("resets to frame 1, paused, when a different animation is selected mid-playback", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWithAnimations([
      {
        number: 0,
        frames: [frame({ time: 5 }), frame({ time: 5 })],
        loopStart: 0,
      },
      { number: 1, frames: [frame({ time: 5 })], loopStart: 0 },
    ]);
    renderAnimationPlayer(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });
    await vi.waitFor(() => expect(drawPixels).toHaveBeenCalledTimes(1));

    root
      .querySelector<HTMLButtonElement>(".animation-player__play-pause")
      ?.click();

    const select = root.querySelector<HTMLSelectElement>(
      ".animation-player__select",
    );
    if (!select) throw new Error("select not found");
    select.value = "1";
    select.dispatchEvent(new Event("change"));

    await vi.waitFor(() => expect(drawPixels).toHaveBeenCalledTimes(2));
    expect(root.textContent).toContain("Frame 1 / 1");
    const playButton = root.querySelector<HTMLButtonElement>(
      ".animation-player__play-pause",
    );
    expect(playButton?.getAttribute("aria-pressed")).toBe("false");

    // No further advance scheduled from the old animation's timer.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(drawPixels).toHaveBeenCalledTimes(2);
  });

  it("discards a slower, superseded decode instead of overwriting a newer frame's preview", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const first = deferred<SpritePixelResult[]>();
    const second = deferred<SpritePixelResult[]>();
    let callCount = 0;
    const resolveSpritePixels = vi.fn(async () => {
      callCount += 1;
      return callCount === 1 ? first.promise : second.promise;
    });
    const character = characterWithAnimations([
      {
        number: 0,
        frames: [frame({ group: 0, image: 0 }), frame({ group: 0, image: 1 })],
        loopStart: 0,
      },
    ]);
    renderAnimationPlayer(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    root.querySelector<HTMLButtonElement>(".animation-player__step")?.click();

    second.resolve([okResult(20, 20)]);
    await vi.waitFor(() => expect(drawPixels).toHaveBeenCalledTimes(1));

    first.resolve([okResult(57, 103)]);
    await Promise.resolve();
    await Promise.resolve();

    expect(drawPixels).toHaveBeenCalledTimes(1);
    expect(drawPixels.mock.calls[0][2]).toBe(20);
  });

  it("draws the collision box overlay only while the toggle is checked", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const drawClsnOverlay = vi.fn();
    const clsn1: ClsnBox[] = [{ left: -2, top: -3, right: 2, bottom: 0 }];
    const clsn2: ClsnBox[] = [{ left: -4, top: -5, right: 4, bottom: 0 }];
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWithAnimations([
      {
        number: 0,
        frames: [frame({ group: 0, image: 1, clsn1, clsn2 })],
        loopStart: 0,
      },
    ]);
    renderAnimationPlayer(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
      drawClsnOverlay,
    });
    await vi.waitFor(() => expect(drawPixels).toHaveBeenCalledTimes(1));
    expect(drawClsnOverlay).not.toHaveBeenCalled();

    root
      .querySelector<HTMLInputElement>(".animation-player__collision")
      ?.click();

    await vi.waitFor(() => expect(drawClsnOverlay).toHaveBeenCalledTimes(1));
    const [canvasArg, clsn1Arg, clsn2Arg, axisXArg, axisYArg] =
      drawClsnOverlay.mock.calls[0];
    expect(canvasArg).toBeInstanceOf(HTMLCanvasElement);
    expect(clsn1Arg).toEqual(clsn1);
    expect(clsn2Arg).toEqual(clsn2);
    expect(axisXArg).toBe(10);
    expect(axisYArg).toBe(10);
  });

  it("associates the loop and collision checkboxes with a visible label", () => {
    const root = document.createElement("div");
    const character = characterWithAnimations([
      { number: 0, frames: [frame()], loopStart: 0 },
    ]);
    renderAnimationPlayer(root, character, sffBytes);

    for (const className of [
      "animation-player__loop",
      "animation-player__collision",
    ]) {
      const input = root.querySelector<HTMLInputElement>(`.${className}`);
      expect(input?.id).toBeTruthy();
      const label = root.querySelector<HTMLLabelElement>(
        `label[for="${input?.id}"]`,
      );
      expect(label?.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("replaces all previous content and state when called again with a different character", () => {
    const root = document.createElement("div");
    renderAnimationPlayer(
      root,
      characterWithAnimations([{ number: 0, frames: [frame()], loopStart: 0 }]),
      sffBytes,
    );
    renderAnimationPlayer(root, null, null);
    expect(root.children).toHaveLength(0);
  });
});
