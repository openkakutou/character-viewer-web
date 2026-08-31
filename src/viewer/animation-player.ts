// The animation player (backlog item 007): plays a loaded character's
// animations back frame by frame, using each frame's resolved sprite image
// (decoded on demand through the same WASM bridge call the sprite browser
// uses — item 005) and its `time` field for per-frame timing, with an
// optional overlay of each frame's collision boxes (Clsn1/Clsn2). Timing,
// looping, blank-frame, and collision-overlay rules not specified anywhere
// upstream are documented in
// .vibe/decisions/009-animation-player-timing-looping-and-collision-overlay-design.md.
import {
  type SpritePixelResult,
  type WasmBridgeOptions,
  resolveSpritePixels as defaultResolveSpritePixels,
} from "../wasm/bridge.ts";
import type {
  Animation,
  CharacterData,
  ClsnBox,
  Frame,
  Sprite,
} from "../wasm/types.ts";
import { computeScaleToFit, defaultDrawPixels } from "./sprite-browser.ts";

/** One game tick, in milliseconds — MUGEN/Ikemen GO's standard 60-ticks/second engine rate (see the ADR above). */
export const MS_PER_TICK = 1000 / 60;

/**
 * How long (in ticks) a frame should hold before advancing. A non-positive
 * value — including MUGEN's real "-1 = hold forever" convention — is
 * clamped to a minimum 1-tick hold; true infinite-hold semantics are out of
 * scope for this item (see the ADR above).
 */
export function effectiveTickDuration(frame: Frame): number {
  return Math.max(frame.time, 1);
}

/**
 * A frame is blank when its sprite reference uses the `.air` "no sprite
 * shown" sentinel — any negative value on `group` and/or `image`, not just
 * the `-1,-1` pair — matching the `character` library's own `IsBlank()`
 * convention.
 */
export function isBlankFrame(frame: Frame): boolean {
  return frame.group < 0 || frame.image < 0;
}

/**
 * Clamps `loopStart` into a valid frame index for `framesLength`, defaulting
 * to 0 for an out-of-range or negative value (malformed/partial WASM data)
 * instead of producing an invalid index.
 */
export function clampLoopStart(
  loopStart: number,
  framesLength: number,
): number {
  if (framesLength <= 0) return 0;
  if (loopStart < 0 || loopStart >= framesLength) return 0;
  return loopStart;
}

/**
 * The next frame index after `currentIndex`, or `null` if playback/stepping
 * should stop there (the last frame, not looping). Reaching the end while
 * looping wraps back to `loopStart` (clamped).
 */
export function computeNextFrameIndex(
  currentIndex: number,
  framesLength: number,
  loopStart: number,
  looping: boolean,
): number | null {
  if (currentIndex + 1 < framesLength) return currentIndex + 1;
  if (!looping) return null;
  return clampLoopStart(loopStart, framesLength);
}

export interface ClsnRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A collision box's on-canvas rectangle, in the same top-left-origin, y-down
 * pixel space as the sprite image itself, offset by the sprite's axis
 * (pivot) point — see the ADR above for why this coordinate system was
 * chosen.
 */
export function computeClsnRect(
  box: ClsnBox,
  axisX: number,
  axisY: number,
): ClsnRect {
  return {
    x: axisX + box.left,
    y: axisY + box.top,
    width: box.right - box.left,
    height: box.bottom - box.top,
  };
}

/** Attack boxes (Clsn1): solid stroke. Vulnerability boxes (Clsn2): dashed — distinguished by shape, not just hue, for colorblind accessibility (see the ADR above). */
const CLSN1_STYLE = {
  stroke: "rgba(255, 64, 64, 0.95)",
  fill: "rgba(255, 64, 64, 0.25)",
  dash: [] as number[],
};
const CLSN2_STYLE = {
  stroke: "rgba(80, 170, 255, 0.95)",
  fill: "rgba(80, 170, 255, 0.2)",
  dash: [4, 3] as number[],
};

function drawClsnBoxes(
  ctx: CanvasRenderingContext2D,
  boxes: readonly ClsnBox[],
  axisX: number,
  axisY: number,
  style: { stroke: string; fill: string; dash: number[] },
): void {
  ctx.save();
  ctx.setLineDash(style.dash);
  ctx.lineWidth = 1;
  ctx.strokeStyle = style.stroke;
  ctx.fillStyle = style.fill;
  for (const box of boxes) {
    const rect = computeClsnRect(box, axisX, axisY);
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }
  ctx.restore();
}

/**
 * Draws the collision box overlay onto `canvas`, on top of whatever was
 * last drawn there — the real, browser-only implementation (jsdom does not
 * implement `HTMLCanvasElement.getContext("2d")` at all, so tests inject a
 * stub instead, same as `drawPixels`). Vulnerability boxes (Clsn2) are drawn
 * before attack boxes (Clsn1) so overlapping attack boxes stay visible on
 * top (see the ADR above).
 */
function defaultDrawClsnOverlay(
  canvas: HTMLCanvasElement,
  clsn1: readonly ClsnBox[],
  clsn2: readonly ClsnBox[],
  axisX: number,
  axisY: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawClsnBoxes(ctx, clsn2, axisX, axisY, CLSN2_STYLE);
  drawClsnBoxes(ctx, clsn1, axisX, axisY, CLSN1_STYLE);
}

export interface AnimationPlayerOptions {
  /** Decodes sprite pixels. Defaults to the real WASM bridge; injectable for testing. */
  resolveSpritePixels?: (
    sffBytes: Uint8Array,
    requests: readonly (readonly [number, number])[],
    overridePaletteBytes: Uint8Array | null,
    options?: WasmBridgeOptions,
  ) => Promise<SpritePixelResult[]>;
  /** Forwarded to the default resolveSpritePixels; ignored if resolveSpritePixels is overridden. */
  bridgeOptions?: WasmBridgeOptions;
  /** Draws decoded pixels onto the preview canvas. Defaults to the real canvas 2D draw; injectable for testing. */
  drawPixels?: (
    canvas: HTMLCanvasElement,
    pixels: Uint8Array,
    width: number,
    height: number,
  ) => void;
  /** Draws the collision box overlay onto the preview canvas. Defaults to the real canvas 2D draw; injectable for testing. */
  drawClsnOverlay?: (
    canvas: HTMLCanvasElement,
    clsn1: readonly ClsnBox[],
    clsn2: readonly ClsnBox[],
    axisX: number,
    axisY: number,
  ) => void;
}

/** Returned by `renderAnimationPlayer` so a caller (the palette picker) can push a new palette override without a full re-render, preserving playback position/state. */
export interface AnimationPlayerHandle {
  /** Re-resolves the current frame with `overridePaletteBytes`, and applies it to every future frame resolve until changed again. */
  setPaletteOverride(overridePaletteBytes: Uint8Array | null): void;
}

const noopHandle: AnimationPlayerHandle = { setPaletteOverride() {} };

/**
 * Renders the animation player into `root`, replacing its previous content
 * (and any in-flight playback/decode state) entirely. `character === null`
 * or `sffBytes === null` (nothing loaded yet) renders nothing, mirroring the
 * sprite browser's own convention.
 */
export function renderAnimationPlayer(
  root: HTMLElement,
  character: CharacterData | null,
  sffBytes: Uint8Array | null,
  options: AnimationPlayerOptions = {},
): AnimationPlayerHandle {
  root.replaceChildren();
  if (character === null || sffBytes === null) return noopHandle;
  // Narrowed into a fresh binding: TS does not carry a parameter's narrowed
  // type into a nested closure since it can't prove the parameter isn't
  // reassigned before the closure runs.
  const sffBytesNonNull: Uint8Array = sffBytes;

  const resolvePixels =
    options.resolveSpritePixels ?? defaultResolveSpritePixels;
  const drawPixels = options.drawPixels ?? defaultDrawPixels;
  const drawClsnOverlay = options.drawClsnOverlay ?? defaultDrawClsnOverlay;

  const spriteByKey = new Map<string, Sprite>();
  for (const group of character.sprites) {
    for (const sprite of group.sprites) {
      spriteByKey.set(`${sprite.group},${sprite.image}`, sprite);
    }
  }

  const panel = document.createElement("wuik-panel");
  panel.className = "animation-player";

  const heading = document.createElement("h3");
  heading.textContent = "Animation Player";
  panel.appendChild(heading);

  if (character.animations.length === 0) {
    const empty = document.createElement("p");
    empty.className = "animation-player__empty";
    empty.textContent = "No animations found.";
    panel.appendChild(empty);
    root.appendChild(panel);
    return noopHandle;
  }

  const sortedAnimations = [...character.animations].sort(
    (a, b) => a.number - b.number,
  );

  const controls = document.createElement("div");
  controls.className = "animation-player__controls";

  const select = document.createElement("select");
  select.className = "animation-player__select";
  select.setAttribute("aria-label", "Animation");
  for (const animation of sortedAnimations) {
    const option = document.createElement("option");
    option.value = String(animation.number);
    option.textContent = `Animation ${animation.number}`;
    select.appendChild(option);
  }

  const playPauseButton = document.createElement("button");
  playPauseButton.type = "button";
  playPauseButton.className = "animation-player__play-pause";

  const stepButton = document.createElement("button");
  stepButton.type = "button";
  stepButton.className = "animation-player__step";
  stepButton.textContent = "Step";
  stepButton.title = "Step to the next frame (pause playback to enable)";

  const loopId = `animation-player-loop-${Math.random().toString(36).slice(2)}`;
  const loopWrapper = document.createElement("div");
  loopWrapper.className = "animation-player__toggle";
  const loopInput = document.createElement("input");
  loopInput.type = "checkbox";
  loopInput.className = "animation-player__loop";
  loopInput.id = loopId;
  const loopLabel = document.createElement("label");
  loopLabel.htmlFor = loopId;
  loopLabel.textContent = "Loop";
  loopWrapper.append(loopInput, loopLabel);

  const collisionId = `animation-player-collision-${Math.random().toString(36).slice(2)}`;
  const collisionWrapper = document.createElement("div");
  collisionWrapper.className = "animation-player__toggle";
  const collisionInput = document.createElement("input");
  collisionInput.type = "checkbox";
  collisionInput.className = "animation-player__collision";
  collisionInput.id = collisionId;
  const collisionLabel = document.createElement("label");
  collisionLabel.htmlFor = collisionId;
  collisionLabel.textContent = "Show collision boxes";
  collisionWrapper.append(collisionInput, collisionLabel);

  const frameCounter = document.createElement("p");
  frameCounter.className = "animation-player__frame-counter";

  controls.append(
    select,
    playPauseButton,
    stepButton,
    loopWrapper,
    collisionWrapper,
    frameCounter,
  );

  const stage = document.createElement("div");
  stage.className = "animation-player__stage";
  const canvas = document.createElement("canvas");
  canvas.className = "animation-player__canvas";
  stage.appendChild(canvas);

  const status = document.createElement("p");
  status.className = "animation-player__preview-status";

  panel.append(controls, stage, status);
  root.appendChild(panel);

  let currentAnimation: Animation = sortedAnimations[0];
  let currentFrameIndex = 0;
  let playing = false;
  let looping = false;
  let showClsn = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Guards against a slower, superseded decode overwriting a newer frame's
  // preview — same pattern as the sprite browser's own selectionToken.
  let selectionToken = 0;
  // The palette picker's active override, if any — see setPaletteOverride
  // below, which reuses showFrame() (already the "refresh what's currently
  // displayed" entry point the collision-overlay toggle relies on) to
  // apply a palette change without disturbing playback state.
  let activeOverride: Uint8Array | null = null;

  function currentFrame(): Frame {
    return currentAnimation.frames[currentFrameIndex];
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function updatePlayPauseButton(): void {
    playPauseButton.textContent = playing ? "Pause" : "Play";
    playPauseButton.setAttribute("aria-pressed", String(playing));
    stepButton.disabled = playing;
  }

  function updateFrameCounter(): void {
    frameCounter.textContent = `Frame ${currentFrameIndex + 1} / ${currentAnimation.frames.length}`;
  }

  function showDecodeError(token: number, message: string): void {
    if (token !== selectionToken) return; // superseded by a later frame
    canvas.hidden = true;
    status.textContent = message;
    status.className =
      "animation-player__preview-status animation-player__preview-status--error";
  }

  function showFrame(): void {
    updateFrameCounter();
    const frame = currentFrame();
    const token = ++selectionToken;

    if (isBlankFrame(frame)) {
      canvas.hidden = true;
      status.textContent = "Blank frame (no sprite for this frame).";
      status.className =
        "animation-player__preview-status animation-player__preview-status--blank";
      return;
    }

    canvas.hidden = true;
    status.textContent = "Loading…";
    status.className = "animation-player__preview-status";

    resolvePixels(
      sffBytesNonNull,
      [[frame.group, frame.image]],
      activeOverride,
      options.bridgeOptions,
    )
      .then(([result]) => {
        if (token !== selectionToken) return; // superseded by a later frame

        if (!result.ok) {
          showDecodeError(token, result.error);
          return;
        }

        const scale = computeScaleToFit(result.width, result.height);
        canvas.style.width = `${result.width * scale}px`;
        canvas.style.height = `${result.height * scale}px`;
        drawPixels(canvas, result.pixels, result.width, result.height);
        canvas.hidden = false;
        status.textContent = "";
        status.className = "animation-player__preview-status";

        if (showClsn) {
          const sprite = spriteByKey.get(`${frame.group},${frame.image}`);
          if (sprite) {
            drawClsnOverlay(
              canvas,
              frame.clsn1,
              frame.clsn2,
              sprite.axisX,
              sprite.axisY,
            );
          }
        }
      })
      .catch((err: unknown) => {
        // A rejected promise (e.g. the WASM bridge itself failing to load)
        // degrades to the same clear error status as an ok:false result,
        // never a silent crash or an unhandled rejection.
        showDecodeError(
          token,
          err instanceof Error ? err.message : String(err),
        );
      });
  }

  function scheduleNextTick(): void {
    clearTimer();
    const ticks = effectiveTickDuration(currentFrame());
    timer = setTimeout(() => {
      const next = computeNextFrameIndex(
        currentFrameIndex,
        currentAnimation.frames.length,
        currentAnimation.loopStart,
        looping,
      );
      if (next === null) {
        playing = false;
        updatePlayPauseButton();
        return;
      }
      currentFrameIndex = next;
      showFrame();
      scheduleNextTick();
    }, ticks * MS_PER_TICK);
  }

  function selectAnimation(animation: Animation): void {
    clearTimer();
    currentAnimation = animation;
    currentFrameIndex = 0;
    playing = false;
    updatePlayPauseButton();
    showFrame();
  }

  playPauseButton.addEventListener("click", () => {
    if (playing) {
      playing = false;
      clearTimer();
      updatePlayPauseButton();
      return;
    }
    playing = true;
    updatePlayPauseButton();
    scheduleNextTick();
  });

  stepButton.addEventListener("click", () => {
    if (playing) return;
    const next = computeNextFrameIndex(
      currentFrameIndex,
      currentAnimation.frames.length,
      currentAnimation.loopStart,
      looping,
    );
    if (next === null) return;
    currentFrameIndex = next;
    showFrame();
  });

  // "click" rather than "change": .click() in this project's jsdom test
  // environment does not reliably synthesize a "change" event for a
  // checkbox, while "click"'s default action (toggling .checked) has
  // already run by the time this listener fires.
  loopInput.addEventListener("click", () => {
    looping = loopInput.checked;
  });

  collisionInput.addEventListener("click", () => {
    showClsn = collisionInput.checked;
    showFrame();
  });

  select.addEventListener("change", () => {
    const animation = sortedAnimations.find(
      (a) => String(a.number) === select.value,
    );
    if (animation) selectAnimation(animation);
  });

  select.value = String(sortedAnimations[0].number);
  updatePlayPauseButton();
  showFrame();

  return {
    setPaletteOverride(overridePaletteBytes) {
      activeOverride = overridePaletteBytes;
      showFrame();
    },
  };
}
