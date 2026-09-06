import {
  MS_PER_TICK,
  computeNextFrameIndex,
  effectiveTickDuration,
  isBlankFrame,
} from "../viewer/animation-player.ts";
import {
  computeScaleToFit,
  defaultDrawPixels,
} from "../viewer/sprite-browser.ts";
// The in-game preview's animation trigger list (backlog item 008): a
// scrollable list of one button per animation number; clicking one plays it
// live in a shared preview stage immediately, replacing whatever was
// playing. Unlike the debug Animation Player (item 007), there is no
// dropdown/step/manual-loop/collision-overlay UI here — this section is
// "in-game", not "inspector" — but it reuses item 007's already-exported
// pure timing helpers (effectiveTickDuration/isBlankFrame/
// computeNextFrameIndex) and the sprite decode/draw helpers
// (computeScaleToFit/defaultDrawPixels) rather than re-implementing them.
// See .vibe/decisions/012-in-game-preview-trigger-buttons-loop-and-stop-toggle.md
// for why a triggered animation loops continuously by default (no opt-in
// checkbox) and why the same button that started it also stops it.
import {
  type SpritePixelResult,
  type WasmBridgeOptions,
  resolveSpritePixels as defaultResolveSpritePixels,
} from "../wasm/bridge.ts";
import type { Animation, CharacterData, Frame } from "../wasm/types.ts";

export interface AnimationTriggersOptions {
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
}

/**
 * Returned by `renderAnimationTriggers` so the workspace shell (item 020's
 * auto-pause-on-navigate-away convention) can stop playback from outside
 * without a full re-render, same shape as `AnimationPlayerHandle.pause()`.
 */
export interface AnimationTriggersHandle {
  /** Stops playback at the current frame, a no-op if nothing is playing. */
  pause(): void;
}

const noopHandle: AnimationTriggersHandle = {
  pause() {},
};

/**
 * Renders the in-game preview's animation trigger list into `root`,
 * replacing its previous content (and any in-flight playback/decode state)
 * entirely. `character === null` or `sffBytes === null` (nothing loaded
 * yet) renders nothing, mirroring the sprite browser's and animation
 * player's own convention.
 */
export function renderAnimationTriggers(
  root: HTMLElement,
  character: CharacterData | null,
  sffBytes: Uint8Array | null,
  options: AnimationTriggersOptions = {},
): AnimationTriggersHandle {
  root.replaceChildren();
  if (character === null || sffBytes === null) return noopHandle;
  // Narrowed into a fresh binding: TS does not carry a parameter's narrowed
  // type into a nested closure since it can't prove the parameter isn't
  // reassigned before the closure runs.
  const sffBytesNonNull: Uint8Array = sffBytes;

  const resolvePixels =
    options.resolveSpritePixels ?? defaultResolveSpritePixels;
  const drawPixels = options.drawPixels ?? defaultDrawPixels;

  const panel = document.createElement("wuik-panel");
  panel.className = "animation-triggers";

  const heading = document.createElement("h3");
  heading.textContent = "In-game Preview";
  panel.appendChild(heading);

  if (character.animations.length === 0) {
    const empty = document.createElement("p");
    empty.className = "animation-triggers__empty";
    empty.textContent = "No animations found.";
    panel.appendChild(empty);
    root.appendChild(panel);
    return noopHandle;
  }

  const sortedAnimations = [...character.animations].sort(
    (a, b) => a.number - b.number,
  );

  const body = document.createElement("div");
  body.className = "animation-triggers__body";

  const list = document.createElement("ul");
  list.className = "animation-triggers__list";
  list.setAttribute("aria-label", "Animations");

  const preview = document.createElement("div");
  preview.className = "animation-triggers__preview";

  const nowPlaying = document.createElement("p");
  nowPlaying.className = "animation-triggers__now-playing";
  nowPlaying.textContent = "No animation selected.";

  const stage = document.createElement("div");
  stage.className = "animation-triggers__stage";
  const canvas = document.createElement("canvas");
  canvas.className = "animation-triggers__canvas";
  canvas.hidden = true;
  stage.appendChild(canvas);

  const status = document.createElement("p");
  status.className = "animation-triggers__status";

  preview.append(nowPlaying, stage, status);
  body.append(list, preview);
  panel.appendChild(body);
  root.appendChild(panel);

  let currentAnimation: Animation | null = null;
  let currentFrameIndex = 0;
  let playing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let activeButton: HTMLButtonElement | null = null;
  // Guards against a slower, superseded decode overwriting a newer
  // animation's preview — same pattern as the sprite browser and animation
  // player.
  let selectionToken = 0;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function currentFrame(): Frame | null {
    if (currentAnimation === null) return null;
    return currentAnimation.frames[currentFrameIndex] ?? null;
  }

  function showDecodeError(token: number, message: string): void {
    if (token !== selectionToken) return; // superseded by a later trigger
    canvas.hidden = true;
    status.textContent = message;
    status.className =
      "animation-triggers__status animation-triggers__status--error";
  }

  function showFrame(): void {
    const frame = currentFrame();
    if (!frame) return;
    const token = ++selectionToken;

    if (isBlankFrame(frame)) {
      canvas.hidden = true;
      status.textContent = "Blank frame (no sprite for this frame).";
      status.className =
        "animation-triggers__status animation-triggers__status--blank";
      return;
    }

    canvas.hidden = true;
    status.textContent = "Loading…";
    status.className = "animation-triggers__status";

    resolvePixels(
      sffBytesNonNull,
      [[frame.group, frame.image]],
      null,
      options.bridgeOptions,
    )
      .then(([result]) => {
        if (token !== selectionToken) return; // superseded by a later trigger

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
        status.className = "animation-triggers__status";
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
    const frame = currentFrame();
    if (!frame || !currentAnimation) return;
    const animation = currentAnimation;
    const ticks = effectiveTickDuration(frame);
    timer = setTimeout(() => {
      // Always loops: an in-game animation keeps playing until another one
      // is triggered or playback is stopped, unlike the debug player's
      // opt-in loop checkbox (see the ADR above).
      const next = computeNextFrameIndex(
        currentFrameIndex,
        animation.frames.length,
        animation.loopStart,
        true,
      );
      if (next === null) return; // a 0-frame animation; nothing to advance to
      currentFrameIndex = next;
      showFrame();
      scheduleNextTick();
    }, ticks * MS_PER_TICK);
  }

  /** Stops playback, freezing the current frame, and clears the active button's pressed state. */
  function stopPlayback(): void {
    clearTimer();
    playing = false;
    if (activeButton) {
      activeButton.setAttribute("aria-pressed", "false");
    }
    nowPlaying.textContent = currentAnimation
      ? `Animation ${currentAnimation.number} (stopped)`
      : "No animation selected.";
  }

  function triggerAnimation(
    animation: Animation,
    button: HTMLButtonElement,
  ): void {
    // Re-clicking the animation that is currently playing stops it in
    // place instead of restarting it — the only "stop" affordance this
    // section has, since there is no separate pause control (see the ADR).
    if (playing && activeButton === button) {
      stopPlayback();
      return;
    }

    clearTimer();
    if (activeButton && activeButton !== button) {
      activeButton.setAttribute("aria-pressed", "false");
    }
    currentAnimation = animation;
    currentFrameIndex = 0;
    playing = true;
    activeButton = button;
    button.setAttribute("aria-pressed", "true");
    nowPlaying.textContent = `Now playing: Animation ${animation.number}`;
    showFrame();
    scheduleNextTick();
  }

  for (const animation of sortedAnimations) {
    const item = document.createElement("li");
    item.className = "animation-triggers__item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "animation-triggers__trigger";
    button.textContent = `Animation ${animation.number}`;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => triggerAnimation(animation, button));
    item.appendChild(button);
    list.appendChild(item);
  }

  return {
    pause: stopPlayback,
  };
}
