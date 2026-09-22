// The animation player (backlog item 007): plays a loaded character's
// animations back frame by frame, using each frame's resolved sprite image
// (decoded on demand through the same WASM bridge call the sprite browser
// uses — item 005) and its `time` field for per-frame timing, with an
// optional overlay of each frame's collision boxes (Clsn1/Clsn2). Timing,
// looping, blank-frame, and collision-overlay rules not specified anywhere
// upstream are documented in
// .vibe/decisions/009-animation-player-timing-looping-and-collision-overlay-design.md.
import {
  type GifExportControlsOptions,
  renderGifExportControls,
} from "../export/gif-export.ts";
import { onLocaleChange, t } from "../i18n/i18n.ts";
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
import {
  MS_PER_TICK,
  effectiveTickDuration,
  isBlankFrame,
} from "./animation-timing.ts";
import { computeScaleToFit, defaultDrawPixels } from "./sprite-browser.ts";

// Re-exported so every existing import site (game-mode/*, this file's own
// tests) keeps working unchanged — see animation-timing.ts's own header for
// why these moved out of this file.
export { MS_PER_TICK, effectiveTickDuration, isBlankFrame };

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
  /** Encodes an Animation to GIF bytes (item 014's "Export GIF"/"Export Stand"). Defaults to the real gifenc-based encoder; injectable for testing. */
  encodeAnimationGif?: GifExportControlsOptions["encodeAnimationGif"];
  /** Saves the encoded GIF bytes as a downloaded file. Defaults to a real Blob + anchor-click download; injectable for testing (jsdom has no `URL.createObjectURL`). */
  triggerDownload?: GifExportControlsOptions["triggerDownload"];
}

/** Returned by `renderAnimationPlayer` so a caller (the palette picker, or the workspace shell) can drive it without a full re-render, preserving playback position/state. */
export interface AnimationPlayerHandle {
  /** Re-resolves the current frame with `overridePaletteBytes`, and applies it to every future frame resolve until changed again. */
  setPaletteOverride(overridePaletteBytes: Uint8Array | null): void;
  /**
   * Stops playback at the current frame, same as pressing Pause — a no-op
   * if playback isn't running. Used by the workspace shell (backlog item
   * 020) to auto-pause when the Animation section is navigated away from,
   * so a self-rescheduling timer doesn't keep decoding frames for a canvas
   * nobody is looking at, and the section resumes exactly where it was left
   * rather than auto-playing again on return.
   */
  pause(): void;
}

const noopHandle: AnimationPlayerHandle = {
  setPaletteOverride() {},
  pause() {},
};

/**
 * `renderAnimationPlayer` is only ever really invoked once per session, but
 * tests call it repeatedly — torn down at the top of every call, before a
 * fresh one is made, so a locale-change subscription from a previous call
 * never accumulates or fires against content no longer on the page. See
 * .vibe/decisions/019-i18n-integration-approach.md.
 */
let currentUnsubscribeLocaleChange: (() => void) | undefined;

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
  currentUnsubscribeLocaleChange?.();
  currentUnsubscribeLocaleChange = undefined;
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
  heading.textContent = t("animationPlayer.heading", "Animation Player");
  panel.appendChild(heading);

  if (character.animations.length === 0) {
    const empty = document.createElement("p");
    empty.className = "animation-player__empty";
    empty.textContent = t("animationPlayer.empty", "No animations found.");
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
  select.setAttribute(
    "aria-label",
    t("animationPlayer.animationSelectLabel", "Animation"),
  );
  const animationOptions: HTMLOptionElement[] = [];
  for (const animation of sortedAnimations) {
    const option = document.createElement("option");
    option.value = String(animation.number);
    option.textContent = t(
      "animationPlayer.animationOption",
      "Animation {{number}}",
      {
        number: String(animation.number),
      },
    );
    select.appendChild(option);
    animationOptions.push(option);
  }

  const playPauseButton = document.createElement("button");
  playPauseButton.type = "button";
  playPauseButton.className = "animation-player__play-pause";

  const stepButton = document.createElement("button");
  stepButton.type = "button";
  stepButton.className = "animation-player__step";
  stepButton.textContent = t("animationPlayer.stepButton", "Step");
  stepButton.title = t(
    "animationPlayer.stepButtonTitle",
    "Step to the next frame (pause playback to enable)",
  );

  const loopId = `animation-player-loop-${Math.random().toString(36).slice(2)}`;
  const loopWrapper = document.createElement("div");
  loopWrapper.className = "animation-player__toggle";
  const loopInput = document.createElement("input");
  loopInput.type = "checkbox";
  loopInput.className = "animation-player__loop";
  loopInput.id = loopId;
  const loopLabel = document.createElement("label");
  loopLabel.htmlFor = loopId;
  loopLabel.textContent = t("animationPlayer.loopLabel", "Loop");
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
  collisionLabel.textContent = t(
    "animationPlayer.collisionLabel",
    "Show collision boxes",
  );
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

  const exportRow = document.createElement("div");
  exportRow.className = "animation-player__export";

  panel.append(controls, stage, status, exportRow);
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

  renderGifExportControls(
    exportRow,
    character,
    sffBytesNonNull,
    () => currentAnimation,
    () => activeOverride,
    {
      resolveSpritePixels: options.resolveSpritePixels,
      bridgeOptions: options.bridgeOptions,
      encodeAnimationGif: options.encodeAnimationGif,
      triggerDownload: options.triggerDownload,
    },
  );

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
    playPauseButton.textContent = playing
      ? t("animationPlayer.pause", "Pause")
      : t("animationPlayer.play", "Play");
    playPauseButton.setAttribute("aria-pressed", String(playing));
    stepButton.disabled = playing;
  }

  function updateFrameCounter(): void {
    frameCounter.textContent = t(
      "animationPlayer.frameCounter",
      "Frame {{current}} / {{total}}",
      {
        current: String(currentFrameIndex + 1),
        total: String(currentAnimation.frames.length),
      },
    );
  }

  // Whether `status` is currently showing one of this module's own
  // translatable texts ("blank"/"loading") — retranslated on a locale
  // change; a raw WASM/bridge decode error or the empty "shown" state is
  // left untouched.
  let previewStatusKind: "blank" | "loading" | "error" | "shown" = "shown";

  function showDecodeError(token: number, message: string): void {
    if (token !== selectionToken) return; // superseded by a later frame
    canvas.hidden = true;
    previewStatusKind = "error";
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
      previewStatusKind = "blank";
      status.textContent = t(
        "animationPlayer.blankFrame",
        "Blank frame (no sprite for this frame).",
      );
      status.className =
        "animation-player__preview-status animation-player__preview-status--blank";
      return;
    }

    canvas.hidden = true;
    previewStatusKind = "loading";
    status.textContent = t("animationPlayer.loading", "Loading…");
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
        previewStatusKind = "shown";
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

  function pausePlayback(): void {
    if (!playing) return;
    playing = false;
    clearTimer();
    updatePlayPauseButton();
  }

  playPauseButton.addEventListener("click", () => {
    if (playing) {
      pausePlayback();
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

  // Live locale switching (backlog item 018): every static label, each
  // animation option's text, the Play/Pause label and frame counter
  // (recomputed from their own already-tracked state), and the preview
  // status (only while it's showing this module's own translatable
  // "blank"/"loading" text) retranslate in place — playback position,
  // loop/collision-overlay state, and an in-flight decode are untouched.
  currentUnsubscribeLocaleChange = onLocaleChange(() => {
    heading.textContent = t("animationPlayer.heading", "Animation Player");
    select.setAttribute(
      "aria-label",
      t("animationPlayer.animationSelectLabel", "Animation"),
    );
    animationOptions.forEach((option, index) => {
      option.textContent = t(
        "animationPlayer.animationOption",
        "Animation {{number}}",
        { number: String(sortedAnimations[index].number) },
      );
    });
    stepButton.textContent = t("animationPlayer.stepButton", "Step");
    stepButton.title = t(
      "animationPlayer.stepButtonTitle",
      "Step to the next frame (pause playback to enable)",
    );
    loopLabel.textContent = t("animationPlayer.loopLabel", "Loop");
    collisionLabel.textContent = t(
      "animationPlayer.collisionLabel",
      "Show collision boxes",
    );
    updatePlayPauseButton();
    updateFrameCounter();
    if (previewStatusKind === "blank") {
      status.textContent = t(
        "animationPlayer.blankFrame",
        "Blank frame (no sprite for this frame).",
      );
    } else if (previewStatusKind === "loading") {
      status.textContent = t("animationPlayer.loading", "Loading…");
    }
  });

  return {
    setPaletteOverride(overridePaletteBytes) {
      activeOverride = overridePaletteBytes;
      showFrame();
    },
    pause: pausePlayback,
  };
}
