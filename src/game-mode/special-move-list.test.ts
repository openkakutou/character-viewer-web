import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MS_PER_TICK } from "../viewer/animation-player.ts";
import type { SpritePixelResult } from "../wasm/bridge.ts";
import type {
  Animation,
  CharacterData,
  Frame,
  StateDef,
} from "../wasm/types.ts";
import {
  renderSpecialMoveList,
  resolveStateAnimation,
} from "./special-move-list.ts";

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

function stateDef(overrides: Partial<StateDef> = {}): StateDef {
  return {
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
    ...overrides,
  };
}

function characterWith(
  stateDefs: StateDef[],
  animations: Animation[] = [],
): CharacterData {
  return {
    name: "Test",
    animations,
    sprites: [],
    stateDefs,
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

describe("resolveStateAnimation", () => {
  it("resolves a literal anim number to the matching animation", () => {
    const animations = [{ number: 200, frames: [frame()], loopStart: 0 }];
    const result = resolveStateAnimation(
      stateDef({ number: 5, anim: 200 }),
      animations,
    );
    expect(result).toBe(animations[0]);
  });

  it("defaults an unset anim (0) to the state's own number, per MUGEN/Ikemen convention", () => {
    const animations = [{ number: 42, frames: [frame()], loopStart: 0 }];
    const result = resolveStateAnimation(
      stateDef({ number: 42, anim: 0 }),
      animations,
    );
    expect(result).toBe(animations[0]);
  });

  it("returns null when the resolved anim number matches no loaded animation", () => {
    const animations = [{ number: 1, frames: [frame()], loopStart: 0 }];
    const result = resolveStateAnimation(
      stateDef({ number: 5, anim: 999 }),
      animations,
    );
    expect(result).toBeNull();
  });

  it('returns null when "anim" is an unevaluated trigger expression, even if the literal field happens to match a loaded animation', () => {
    const animations = [{ number: 0, frames: [frame()], loopStart: 0 }];
    const result = resolveStateAnimation(
      stateDef({
        number: 5,
        anim: 0,
        headerExprs: { anim: "IfElse(Life < 500, 200, 201)" },
      }),
      animations,
    );
    expect(result).toBeNull();
  });
});

describe("renderSpecialMoveList", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when no character is loaded", () => {
    const root = document.createElement("div");
    renderSpecialMoveList(root, null, null);
    expect(root.children).toHaveLength(0);
  });

  it("renders nothing when sffBytes is missing", () => {
    const root = document.createElement("div");
    renderSpecialMoveList(root, characterWith([]), null);
    expect(root.children).toHaveLength(0);
  });

  it("shows an explicit empty state for a character with no Statedefs", () => {
    const root = document.createElement("div");
    renderSpecialMoveList(root, characterWith([]), sffBytes);
    expect(root.textContent).toContain("No Statedefs found.");
  });

  it("lists every state number as its own button, sorted", () => {
    const root = document.createElement("div");
    const character = characterWith([
      stateDef({ number: 200 }),
      stateDef({ number: 5 }),
      stateDef({ number: 100 }),
    ]);
    renderSpecialMoveList(root, character, sffBytes);

    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".special-move-list__trigger"),
    );
    expect(buttons.map((b) => b.textContent)).toEqual([
      "State 5no animation",
      "State 100no animation",
      "State 200no animation",
    ]);
  });

  it("marks only states with no resolvable animation with a visible hint", () => {
    const root = document.createElement("div");
    const character = characterWith(
      [
        stateDef({ number: 200, anim: 200 }),
        stateDef({ number: 5, anim: 999 }),
      ],
      [{ number: 200, frames: [frame()], loopStart: 0 }],
    );
    renderSpecialMoveList(root, character, sffBytes);

    const hints = root.querySelectorAll(".special-move-list__hint");
    expect(hints).toHaveLength(1);
    expect(hints[0].closest(".special-move-list__trigger")?.textContent).toBe(
      "State 5no animation",
    );
  });

  it("does not play anything until a button is clicked", () => {
    const root = document.createElement("div");
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWith(
      [stateDef({ number: 0, anim: 0 })],
      [{ number: 0, frames: [frame()], loopStart: 0 }],
    );
    renderSpecialMoveList(root, character, sffBytes, { resolveSpritePixels });

    expect(resolveSpritePixels).not.toHaveBeenCalled();
    expect(root.textContent).toContain("No state selected.");
  });

  it("clicking a state with a resolvable animation decodes and draws that animation's first frame immediately", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(57, 103)],
    );
    const character = characterWith(
      [stateDef({ number: 3, anim: 7 })],
      [
        {
          number: 7,
          frames: [
            frame({ group: 1, image: 2 }),
            frame({ group: 1, image: 3 }),
          ],
          loopStart: 0,
        },
      ],
    );
    renderSpecialMoveList(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    root
      .querySelector<HTMLButtonElement>(".special-move-list__trigger")
      ?.click();

    await vi.advanceTimersByTimeAsync(0);
    expect(drawPixels).toHaveBeenCalledTimes(1);
    expect(resolveSpritePixels).toHaveBeenCalledWith(
      sffBytes,
      [[1, 2]],
      null,
      undefined,
    );
    expect(root.textContent).toContain("Now playing: State 3 — Animation 7");
    const button = root.querySelector<HTMLButtonElement>(
      ".special-move-list__trigger",
    );
    expect(button?.getAttribute("aria-pressed")).toBe("true");
  });

  it("clicking a state with no resolvable animation shows a clear status with no decode attempt, no Loading flash", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWith([stateDef({ number: 9, anim: 500 })], []);
    renderSpecialMoveList(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    root
      .querySelector<HTMLButtonElement>(".special-move-list__trigger")
      ?.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(resolveSpritePixels).not.toHaveBeenCalled();
    expect(drawPixels).not.toHaveBeenCalled();
    expect(root.textContent).toContain("State 9 selected — no animation");
    expect(root.textContent).toContain(
      "No animation associated with this state.",
    );
    const canvas = root.querySelector<HTMLCanvasElement>(
      ".special-move-list__canvas",
    );
    expect(canvas?.hidden).toBe(true);
    const status = root.querySelector(".special-move-list__status");
    expect(status?.className).toContain(
      "special-move-list__status--unavailable",
    );
  });

  it("treats an unevaluated anim trigger expression the same as an unresolvable state", async () => {
    const root = document.createElement("div");
    const character = characterWith(
      [
        stateDef({
          number: 12,
          anim: 0,
          headerExprs: { anim: "IfElse(Life < 500, 200, 201)" },
        }),
      ],
      [{ number: 12, frames: [frame()], loopStart: 0 }], // would match by number if not for the expression
    );
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    renderSpecialMoveList(root, character, sffBytes, { resolveSpritePixels });

    root
      .querySelector<HTMLButtonElement>(".special-move-list__trigger")
      ?.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(resolveSpritePixels).not.toHaveBeenCalled();
    expect(root.textContent).toContain(
      "No animation associated with this state.",
    );
  });

  it("cleanly replaces a playing state when a different button is clicked, no stale frames", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWith(
      [stateDef({ number: 0, anim: 0 }), stateDef({ number: 1, anim: 1 })],
      [
        {
          number: 0,
          frames: [frame({ time: 3 }), frame({ time: 3 })],
          loopStart: 0,
        },
        // A long hold so it does not naturally loop again within this
        // test's own assertion window — isolating the assertion to "the
        // first state's own timer chain is dead".
        { number: 1, frames: [frame({ time: 1000 })], loopStart: 0 },
      ],
    );
    renderSpecialMoveList(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    const [firstButton, secondButton] = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".special-move-list__trigger"),
    );
    firstButton.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(drawPixels).toHaveBeenCalledTimes(1);

    secondButton.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(drawPixels).toHaveBeenCalledTimes(2);

    expect(root.textContent).toContain("Now playing: State 1 — Animation 1");
    expect(firstButton.getAttribute("aria-pressed")).toBe("false");
    expect(secondButton.getAttribute("aria-pressed")).toBe("true");

    await vi.advanceTimersByTimeAsync(50 * MS_PER_TICK);
    expect(drawPixels).toHaveBeenCalledTimes(2);
  });

  it("switching from a playing state to an unresolvable one stops playback and clears the stage", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWith(
      [stateDef({ number: 0, anim: 0 }), stateDef({ number: 1, anim: 999 })],
      [
        {
          number: 0,
          frames: [frame({ time: 3 }), frame({ time: 3 })],
          loopStart: 0,
        },
      ],
    );
    renderSpecialMoveList(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    const [firstButton, secondButton] = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".special-move-list__trigger"),
    );
    firstButton.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(drawPixels).toHaveBeenCalledTimes(1);

    secondButton.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(root.textContent).toContain("State 1 selected — no animation");
    expect(firstButton.getAttribute("aria-pressed")).toBe("false");
    const canvas = root.querySelector<HTMLCanvasElement>(
      ".special-move-list__canvas",
    );
    expect(canvas?.hidden).toBe(true);

    // The old state's own timer chain must not still be scheduled.
    await vi.advanceTimersByTimeAsync(50 * MS_PER_TICK);
    expect(drawPixels).toHaveBeenCalledTimes(1);
  });

  it("clicking the currently playing state's own button again stops it, freezing the last frame", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWith(
      [stateDef({ number: 7, anim: 7 })],
      [
        {
          number: 7,
          frames: [frame({ time: 3 }), frame({ time: 3 })],
          loopStart: 0,
        },
      ],
    );
    renderSpecialMoveList(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    const button = root.querySelector<HTMLButtonElement>(
      ".special-move-list__trigger",
    );
    button?.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(drawPixels).toHaveBeenCalledTimes(1);

    button?.click(); // toggle off
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(root.textContent).toContain("State 7 (stopped)");

    await vi.advanceTimersByTimeAsync(50 * MS_PER_TICK);
    expect(drawPixels).toHaveBeenCalledTimes(1);
  });

  it("clicking the currently selected unresolvable state's own button again clears the selection back to idle", async () => {
    const root = document.createElement("div");
    const character = characterWith([stateDef({ number: 9, anim: 500 })], []);
    renderSpecialMoveList(root, character, sffBytes);

    const button = root.querySelector<HTMLButtonElement>(
      ".special-move-list__trigger",
    );
    button?.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(root.textContent).toContain("State 9 selected — no animation");

    button?.click(); // toggle off
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(root.textContent).toContain("No state selected.");
    expect(root.textContent).not.toContain(
      "No animation associated with this state.",
    );
  });

  it("renders a blank frame as empty with a distinct status, no decode attempted", async () => {
    const root = document.createElement("div");
    const drawPixels = vi.fn();
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [okResult(20, 20)],
    );
    const character = characterWith(
      [stateDef({ number: 0, anim: 0 })],
      [{ number: 0, frames: [frame({ group: -1, image: -1 })], loopStart: 0 }],
    );
    renderSpecialMoveList(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels,
    });

    root
      .querySelector<HTMLButtonElement>(".special-move-list__trigger")
      ?.click();
    await Promise.resolve();

    expect(resolveSpritePixels).not.toHaveBeenCalled();
    expect(drawPixels).not.toHaveBeenCalled();
    expect(root.textContent).toContain("Blank frame");
  });

  it("shows a clear error status instead of a broken image on decode failure", async () => {
    const root = document.createElement("div");
    const resolveSpritePixels = vi.fn(
      async (): Promise<SpritePixelResult[]> => [
        { ok: false, error: "unsupported pixel format" },
      ],
    );
    const character = characterWith(
      [stateDef({ number: 0, anim: 0 })],
      [{ number: 0, frames: [frame()], loopStart: 0 }],
    );
    renderSpecialMoveList(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels: vi.fn(),
    });

    root
      .querySelector<HTMLButtonElement>(".special-move-list__trigger")
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
    const character = characterWith(
      [stateDef({ number: 0, anim: 0 })],
      [{ number: 0, frames: [frame()], loopStart: 0 }],
    );
    renderSpecialMoveList(root, character, sffBytes, {
      resolveSpritePixels,
      drawPixels: vi.fn(),
    });

    root
      .querySelector<HTMLButtonElement>(".special-move-list__trigger")
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
      const character = characterWith(
        [stateDef({ number: 4, anim: 4 })],
        [
          {
            number: 4,
            frames: [frame({ time: 3 }), frame({ time: 3 })],
            loopStart: 0,
          },
        ],
      );
      const handle = renderSpecialMoveList(root, character, sffBytes, {
        resolveSpritePixels,
        drawPixels,
      });
      const button = root.querySelector<HTMLButtonElement>(
        ".special-move-list__trigger",
      );
      button?.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(drawPixels).toHaveBeenCalledTimes(1);

      handle.pause();

      expect(button?.getAttribute("aria-pressed")).toBe("false");
      expect(root.textContent).toContain("State 4 (stopped)");

      await vi.advanceTimersByTimeAsync(50 * MS_PER_TICK);
      expect(drawPixels).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when nothing is selected", () => {
      const root = document.createElement("div");
      const character = characterWith([stateDef({ number: 0, anim: 0 })], []);
      const handle = renderSpecialMoveList(root, character, sffBytes);
      expect(() => handle.pause()).not.toThrow();
      expect(root.textContent).toContain("No state selected.");
    });

    it("is a no-op (noop handle) when nothing is loaded", () => {
      const root = document.createElement("div");
      const handle = renderSpecialMoveList(root, null, null);
      expect(() => handle.pause()).not.toThrow();
    });
  });

  it("replaces all previous content and state when called again with a different character", () => {
    const root = document.createElement("div");
    renderSpecialMoveList(
      root,
      characterWith(
        [stateDef({ number: 0, anim: 0 })],
        [{ number: 0, frames: [frame()], loopStart: 0 }],
      ),
      sffBytes,
    );
    renderSpecialMoveList(root, null, null);
    expect(root.children).toHaveLength(0);
  });
});
