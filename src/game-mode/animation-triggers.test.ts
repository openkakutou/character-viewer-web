import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MS_PER_TICK } from "../viewer/animation-player.ts";
import type { SpritePixelResult } from "../wasm/bridge.ts";
import type { Animation, CharacterData, Frame } from "../wasm/types.ts";
import { renderAnimationTriggers } from "./animation-triggers.ts";

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
    sprites: [],
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

describe("renderAnimationTriggers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when no character is loaded", () => {
    const root = document.createElement("div");
    renderAnimationTriggers(root, null, null);
    expect(root.children).toHaveLength(0);
  });

  it("renders nothing when sffBytes is missing", () => {
    const root = document.createElement("div");
    renderAnimationTriggers(root, characterWithAnimations([]), null);
    expect(root.children).toHaveLength(0);
  });

  it("shows an explicit empty state for a character with no animations", () => {
    const root = document.createElement("div");
    renderAnimationTriggers(root, characterWithAnimations([]), sffBytes);
    expect(root.textContent).toContain("No animations");
  });

  it("lists every animation number as its own button, sorted", () => {
    const root = document.createElement("div");
    const character = characterWithAnimations([
      { number: 200, frames: [frame()], loopStart: 0 },
      { number: 5, frames: [frame()], loopStart: 0 },
      { number: 100, frames: [frame()], loopStart: 0 },
    ]);
    renderAnimationTriggers(root, character, sffBytes);

    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".animation-triggers__trigger"),
    );
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Animation 5",
      "Animation 100",
      "Animation 200",
    ]);
  });

  it("puts the button list in its own independently scrollable container", () => {
    const root = document.createElement("div");
    const animations = Array.from({ length: 50 }, (_, i) => ({
      number: i,
      frames: [frame()],
      loopStart: 0,
    }));
    renderAnimationTriggers(
      root,
      characterWithAnimations(animations),
      sffBytes,
    );

    const list = root.querySelector(".animation-triggers__list");
    expect(list).not.toBeNull();
    expect(list?.children).toHaveLength(50);
  });

  it("does not play anything until a button is clicked", () => {
    const root = document.createElement("div");
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWithAnimations([
      { number: 0, frames: [frame()], loopStart: 0 },
    ]);
    renderAnimationTriggers(root, character, sffBytes, { resolveSpritePixels });

    expect(resolveSpritePixels).not.toHaveBeenCalled();
    expect(root.textContent).toContain("No animation selected");
  });

  it("clicking a button decodes and draws that animation's first frame immediately", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(57, 103)],
    );
    const character = characterWithAnimations([
      {
        number: 3,
        frames: [frame({ group: 1, image: 2 }), frame({ group: 1, image: 3 })],
        loopStart: 0,
      },
    ]);
    renderAnimationTriggers(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    root
      .querySelector<HTMLButtonElement>(".animation-triggers__trigger")
      ?.click();

    await vi.advanceTimersByTimeAsync(0);
    expect(drawPixels).toHaveBeenCalledTimes(1);
    expect(resolveSpritePixels).toHaveBeenCalledWith(
      sffBytes,
      [[1, 2]],
      null,
      undefined,
    );
    expect(root.textContent).toContain("Now playing: Animation 3");
    const button = root.querySelector<HTMLButtonElement>(
      ".animation-triggers__trigger",
    );
    expect(button?.getAttribute("aria-pressed")).toBe("true");
  });

  it("loops the triggered animation continuously without a manual loop toggle", async () => {
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
        loopStart: 0,
      },
    ]);
    renderAnimationTriggers(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    root
      .querySelector<HTMLButtonElement>(".animation-triggers__trigger")
      ?.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(drawPixels).toHaveBeenCalledTimes(1);

    // Frame 1 -> frame 2 -> wraps back to frame 1 -> frame 2 again, with no
    // Loop checkbox anywhere to have enabled this.
    await vi.advanceTimersByTimeAsync(MS_PER_TICK);
    await vi.advanceTimersByTimeAsync(MS_PER_TICK);
    await vi.advanceTimersByTimeAsync(MS_PER_TICK);
    expect(root.querySelector(".animation-triggers__loop")).toBeNull();
    expect(drawPixels.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("cleanly replaces a playing animation when a different button is clicked, no stale frames", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWithAnimations([
      {
        number: 0,
        frames: [frame({ time: 3 }), frame({ time: 3 })],
        loopStart: 0,
      },
      // A long hold on the second animation so it does not naturally loop
      // again within this test's own assertion window below — isolating
      // the assertion to "the first animation's own timer chain is dead",
      // not "did the still-legitimately-looping second one redraw".
      { number: 1, frames: [frame({ time: 1000 })], loopStart: 0 },
    ]);
    renderAnimationTriggers(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    const [firstButton, secondButton] = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".animation-triggers__trigger"),
    );
    firstButton.click();
    // Flushes the pending decode microtask without advancing fake time —
    // vi.waitFor's own internal fake-timer advancement would otherwise let
    // the just-started continuous loop tick ahead non-deterministically.
    await vi.advanceTimersByTimeAsync(0);
    expect(drawPixels).toHaveBeenCalledTimes(1);

    secondButton.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(drawPixels).toHaveBeenCalledTimes(2);

    expect(root.textContent).toContain("Now playing: Animation 1");
    expect(firstButton.getAttribute("aria-pressed")).toBe("false");
    expect(secondButton.getAttribute("aria-pressed")).toBe("true");

    // The old animation's own timer chain must not still be scheduled —
    // advancing time must not draw a further, stale frame from it.
    await vi.advanceTimersByTimeAsync(50 * MS_PER_TICK);
    expect(drawPixels).toHaveBeenCalledTimes(2);
  });

  it("clicking the currently playing animation's own button again stops it, freezing the last frame", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWithAnimations([
      {
        number: 7,
        frames: [frame({ time: 3 }), frame({ time: 3 })],
        loopStart: 0,
      },
    ]);
    renderAnimationTriggers(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    const button = root.querySelector<HTMLButtonElement>(
      ".animation-triggers__trigger",
    );
    button?.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(drawPixels).toHaveBeenCalledTimes(1);

    button?.click(); // toggle off
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(root.textContent).toContain("Animation 7 (stopped)");

    // No further frame advance once stopped, even well past every frame's hold.
    await vi.advanceTimersByTimeAsync(50 * MS_PER_TICK);
    expect(drawPixels).toHaveBeenCalledTimes(1);
  });

  it("renders a blank frame as empty with a distinct status, no decode attempted", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWithAnimations([
      { number: 0, frames: [frame({ group: -1, image: -1 })], loopStart: 0 },
    ]);
    renderAnimationTriggers(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    root
      .querySelector<HTMLButtonElement>(".animation-triggers__trigger")
      ?.click();
    await Promise.resolve();

    expect(resolveSpritePixels).not.toHaveBeenCalled();
    expect(drawPixels).not.toHaveBeenCalled();
    expect(root.textContent).toContain("Blank frame");
    const canvas = root.querySelector<HTMLCanvasElement>(
      ".animation-triggers__canvas",
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
    renderAnimationTriggers(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels: vi.fn(),
    });

    root
      .querySelector<HTMLButtonElement>(".animation-triggers__trigger")
      ?.click();

    await vi.waitFor(() => {
      expect(root.textContent).toContain("unsupported pixel format");
    });
  });

  it("degrades to a clear error status when the decode promise itself rejects", async () => {
    const root = document.createElement("div");
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => {
        throw new Error("bridge unavailable");
      },
    );
    const character = characterWithAnimations([
      { number: 0, frames: [frame()], loopStart: 0 },
    ]);
    renderAnimationTriggers(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels: vi.fn(),
    });

    root
      .querySelector<HTMLButtonElement>(".animation-triggers__trigger")
      ?.click();

    await vi.waitFor(() => {
      expect(root.textContent).toContain("bridge unavailable");
    });
  });

  describe("pause() (workspace shell auto-pause when the section is hidden)", () => {
    it("stops an in-progress playback and clears the active button's pressed state", async () => {
      const root = document.createElement("div");
      const drawPixels = vi.fn();
      const resolveSpritePixels = vi.fn(
        async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
      );
      const character = characterWithAnimations([
        {
          number: 4,
          frames: [frame({ time: 3 }), frame({ time: 3 })],
          loopStart: 0,
        },
      ]);
      const handle = renderAnimationTriggers(root, character, sffBytes, {
        resolveSpritePixels,
        drawPixels,
      });
      const button = root.querySelector<HTMLButtonElement>(
        ".animation-triggers__trigger",
      );
      button?.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(drawPixels).toHaveBeenCalledTimes(1);

      handle.pause();

      expect(button?.getAttribute("aria-pressed")).toBe("false");
      expect(root.textContent).toContain("Animation 4 (stopped)");

      await vi.advanceTimersByTimeAsync(50 * MS_PER_TICK);
      expect(drawPixels).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when nothing is playing", () => {
      const root = document.createElement("div");
      const character = characterWithAnimations([
        { number: 0, frames: [frame()], loopStart: 0 },
      ]);
      const handle = renderAnimationTriggers(root, character, sffBytes);
      expect(() => handle.pause()).not.toThrow();
      expect(root.textContent).toContain("No animation selected");
    });

    it("is a no-op (noop handle) when nothing is loaded", () => {
      const root = document.createElement("div");
      const handle = renderAnimationTriggers(root, null, null);
      expect(() => handle.pause()).not.toThrow();
    });
  });

  it("replaces all previous content and state when called again with a different character", () => {
    const root = document.createElement("div");
    renderAnimationTriggers(
      root,
      characterWithAnimations([{ number: 0, frames: [frame()], loopStart: 0 }]),
      sffBytes,
    );
    renderAnimationTriggers(root, null, null);
    expect(root.children).toHaveLength(0);
  });
});
