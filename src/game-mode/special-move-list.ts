// The in-game preview's Special Moves list (backlog item 009): a
// scrollable list of one button per Statedef (State); clicking one
// force-plays that state's associated animation live in its own preview
// stage — a direct Statedef trigger (like a MUGEN/Ikemen debug menu), not a
// simulation of real command input (evaluating `.cmd` files or `.cns`
// trigger expressions is explicitly out of scope, see the backlog item).
// This is a near-twin of item 008's `animation-triggers.ts` rather than an
// addition to it, and reuses the same pure timing/decode/draw helpers that
// module already reuses from `animation-player.ts`/`sprite-browser.ts` —
// see .vibe/decisions/013-special-moves-own-section-not-merged-into-in-game-preview.md
// for why this is its own section with its own stage instead of a second
// list feeding item 008's own state machine.
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
import {
  type SpritePixelResult,
  type WasmBridgeOptions,
  resolveSpritePixels as defaultResolveSpritePixels,
} from "../wasm/bridge.ts";
import type {
  Animation,
  CharacterData,
  Frame,
  StateDef,
} from "../wasm/types.ts";

export interface SpecialMoveListOptions {
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
 * Returned by `renderSpecialMoveList` so the workspace shell (item 020's
 * auto-pause-on-navigate-away convention) can stop playback from outside
 * without a full re-render, same shape as the other game-mode/viewer
 * playback handles.
 */
export interface SpecialMoveListHandle {
  /** Stops playback at the current frame, a no-op if nothing is playing. */
  pause(): void;
}

const noopHandle: SpecialMoveListHandle = {
  pause() {},
};

/**
 * Resolves the Animation a Statedef's "anim" header field points at, or
 * `null` when there is no clearly associated animation:
 * - "anim" held an unevaluated MUGEN/Ikemen trigger expression (recorded in
 *   `headerExprs.anim` instead of the typed field) — evaluating it is out
 *   of scope for this app (see the backlog item's own Description).
 * - the resolved number (the literal "anim" value, or the state's own
 *   `number` when "anim" was left at its "not set" zero value, per
 *   MUGEN/Ikemen's own default) matches none of the loaded animations.
 */
export function resolveStateAnimation(
  stateDef: StateDef,
  animations: readonly Animation[],
): Animation | null {
  if (stateDef.headerExprs.anim !== undefined) return null;
  const resolvedNumber = stateDef.anim === 0 ? stateDef.number : stateDef.anim;
  return animations.find((a) => a.number === resolvedNumber) ?? null;
}

/**
 * Renders the Special Moves list into `root`, replacing its previous
 * content (and any in-flight playback/decode state) entirely.
 * `character === null` or `sffBytes === null` (nothing loaded yet) renders
 * nothing, mirroring the sibling game-mode/viewer sections' own convention.
 */
export function renderSpecialMoveList(
  root: HTMLElement,
  character: CharacterData | null,
  sffBytes: Uint8Array | null,
  options: SpecialMoveListOptions = {},
): SpecialMoveListHandle {
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
  panel.className = "special-move-list";

  const heading = document.createElement("h3");
  heading.textContent = "Special Moves";
  panel.appendChild(heading);

  if (character.stateDefs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "special-move-list__empty";
    empty.textContent = "No Statedefs found.";
    panel.appendChild(empty);
    root.appendChild(panel);
    return noopHandle;
  }

  const sortedStateDefs = [...character.stateDefs].sort(
    (a, b) => a.number - b.number,
  );

  const body = document.createElement("div");
  body.className = "special-move-list__body";

  const list = document.createElement("ul");
  list.className = "special-move-list__list";
  list.setAttribute("aria-label", "States");

  const preview = document.createElement("div");
  preview.className = "special-move-list__preview";

  const nowPlaying = document.createElement("p");
  nowPlaying.className = "special-move-list__now-playing";
  nowPlaying.textContent = "No state selected.";

  const stage = document.createElement("div");
  stage.className = "special-move-list__stage";
  const canvas = document.createElement("canvas");
  canvas.className = "special-move-list__canvas";
  canvas.hidden = true;
  stage.appendChild(canvas);

  const status = document.createElement("p");
  status.className = "special-move-list__status";

  preview.append(nowPlaying, stage, status);
  body.append(list, preview);
  panel.appendChild(body);
  root.appendChild(panel);

  let currentAnimation: Animation | null = null;
  let currentFrameIndex = 0;
  let currentStateNumber: number | null = null;
  let playing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let activeButton: HTMLButtonElement | null = null;
  // Guards against a slower, superseded decode overwriting a newer state's
  // preview — same pattern as the sprite browser, animation player, and
  // item 008's animation-triggers.
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
      "special-move-list__status special-move-list__status--error";
  }

  function showFrame(): void {
    const frame = currentFrame();
    if (!frame) return;
    const token = ++selectionToken;

    if (isBlankFrame(frame)) {
      canvas.hidden = true;
      status.textContent = "Blank frame (no sprite for this frame).";
      status.className =
        "special-move-list__status special-move-list__status--blank";
      return;
    }

    canvas.hidden = true;
    status.textContent = "Loading…";
    status.className = "special-move-list__status";

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
        status.className = "special-move-list__status";
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
      // Always loops: an in-game preview keeps playing until another state
      // is triggered or playback is stopped, same as item 008's own
      // animation triggers (no opt-in loop checkbox).
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

  /** Shows the distinct "no animation" status, skipping the decode pipeline entirely. */
  function showUnavailable(): void {
    canvas.hidden = true;
    status.textContent = "No animation associated with this state.";
    status.className =
      "special-move-list__status special-move-list__status--unavailable";
  }

  /** Stops playback, freezing the current frame, and clears the active button's pressed state. */
  function stopPlayback(): void {
    clearTimer();
    playing = false;
    if (activeButton) {
      activeButton.setAttribute("aria-pressed", "false");
    }
    nowPlaying.textContent =
      currentStateNumber !== null
        ? `State ${currentStateNumber} (stopped)`
        : "No state selected.";
    activeButton = null;
    currentStateNumber = null;
  }

  /** Clears an unresolvable state's own selection back to full idle — there is nothing to freeze. */
  function clearSelection(): void {
    if (activeButton) {
      activeButton.setAttribute("aria-pressed", "false");
    }
    activeButton = null;
    currentStateNumber = null;
    canvas.hidden = true;
    status.textContent = "";
    status.className = "special-move-list__status";
    nowPlaying.textContent = "No state selected.";
  }

  function triggerState(
    stateDef: StateDef,
    resolvedAnimation: Animation | null,
    button: HTMLButtonElement,
  ): void {
    // Re-clicking the currently selected row stops it in place instead of
    // restarting it — the only "stop" affordance this section has, same as
    // item 008's own animation triggers.
    if (activeButton === button) {
      if (playing) {
        stopPlayback(); // freezes the last frame, matching item 008
      } else {
        clearSelection(); // an unresolvable selection has no frame to freeze
      }
      return;
    }

    clearTimer();
    if (activeButton && activeButton !== button) {
      activeButton.setAttribute("aria-pressed", "false");
    }
    activeButton = button;
    currentStateNumber = stateDef.number;
    button.setAttribute("aria-pressed", "true");

    if (resolvedAnimation === null) {
      playing = false;
      currentAnimation = null;
      nowPlaying.textContent = `State ${stateDef.number} selected — no animation`;
      showUnavailable();
      return;
    }

    currentAnimation = resolvedAnimation;
    currentFrameIndex = 0;
    playing = true;
    nowPlaying.textContent = `Now playing: State ${stateDef.number} — Animation ${resolvedAnimation.number}`;
    showFrame();
    scheduleNextTick();
  }

  for (const stateDefEntry of sortedStateDefs) {
    const resolvedAnimation = resolveStateAnimation(
      stateDefEntry,
      character.animations,
    );

    const item = document.createElement("li");
    item.className = "special-move-list__item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "special-move-list__trigger";
    button.setAttribute("aria-pressed", "false");

    const label = document.createElement("span");
    label.className = "special-move-list__label";
    label.textContent = `State ${stateDefEntry.number}`;
    button.appendChild(label);

    if (resolvedAnimation === null) {
      const hint = document.createElement("span");
      hint.className = "special-move-list__hint";
      hint.textContent = "no animation";
      button.appendChild(hint);
    }

    button.addEventListener("click", () =>
      triggerState(stateDefEntry, resolvedAnimation, button),
    );
    item.appendChild(button);
    list.appendChild(item);
  }

  return {
    pause: () => {
      if (!activeButton) return; // nothing selected: no-op
      if (playing) {
        stopPlayback();
      } else {
        clearSelection(); // an unresolvable selection has no playback to stop
      }
    },
  };
}
