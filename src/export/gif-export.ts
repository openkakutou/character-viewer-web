// GIF export (backlog item 014): builds a downloadable animated GIF from an
// already-loaded character's Animation data, reusing the same resolved-
// sprite + palette pipeline `animation-player.ts` already uses for live
// playback rather than a separate rendering path. Two entry points render
// into the Animation Player panel: "Export GIF" (whatever animation/palette
// is currently shown there) and "Export Stand" (always Animation 0, by
// convention — see
// .vibe/decisions/016-stand-animation-identification-and-export-filenames.md).
//
// Every frame in a GIF shares one fixed logical-screen size (`gifenc` always
// writes a frame at position (0,0) covering the full screen), so frames
// whose sprites differ in size are composited onto one shared canvas, axis-
// point-aligned — see
// .vibe/decisions/015-gif-export-frame-compositing.md — before being
// quantized and encoded.
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { onLocaleChange, t } from "../i18n/i18n.ts";
import {
  MS_PER_TICK,
  effectiveTickDuration,
  isBlankFrame,
} from "../viewer/animation-timing.ts";
import {
  type SpritePixelResult,
  type WasmBridgeOptions,
  resolveSpritePixels as defaultResolveSpritePixels,
} from "../wasm/bridge.ts";
import type { Animation, CharacterData, Frame, Sprite } from "../wasm/types.ts";

/** A frame's draw offset on the shared GIF canvas, or `null` for a frame with nothing to draw (blank, or an unresolvable sprite reference). */
export interface GifFrameOffset {
  x: number;
  y: number;
}

/** The shared canvas every frame of one exported GIF is composited onto. */
export interface GifCanvasLayout {
  width: number;
  height: number;
  /** Same length and order as the source `frames` array. */
  frameOffsets: (GifFrameOffset | null)[];
}

/**
 * Computes the shared canvas size and each frame's own draw offset, from
 * sprite *metadata* alone (`Sprite.width`/`height`/`axisX`/`axisY`) — no
 * pixel decode needed yet. The canvas is the union of every referenced
 * sprite's bounding box relative to its own axis point, so every frame's
 * axis point lands at the same canvas position (see the ADR referenced
 * above). A frame with nothing to draw (blank, or a `(group, image)` this
 * character's own sprite list doesn't contain — malformed/partial data)
 * contributes nothing to the bounding box and gets a `null` offset.
 */
export function computeGifCanvasLayout(
  frames: readonly Frame[],
  spriteByKey: ReadonlyMap<string, Sprite>,
): GifCanvasLayout {
  let minLeft = 0;
  let minTop = 0;
  let maxRight = 0;
  let maxBottom = 0;
  let hasBounds = false;

  function spriteFor(frame: Frame): Sprite | null {
    if (isBlankFrame(frame)) return null;
    return spriteByKey.get(`${frame.group},${frame.image}`) ?? null;
  }

  for (const frame of frames) {
    const sprite = spriteFor(frame);
    if (!sprite) continue;
    const left = -sprite.axisX;
    const top = -sprite.axisY;
    const right = sprite.width - sprite.axisX;
    const bottom = sprite.height - sprite.axisY;
    if (!hasBounds) {
      minLeft = left;
      minTop = top;
      maxRight = right;
      maxBottom = bottom;
      hasBounds = true;
    } else {
      minLeft = Math.min(minLeft, left);
      minTop = Math.min(minTop, top);
      maxRight = Math.max(maxRight, right);
      maxBottom = Math.max(maxBottom, bottom);
    }
  }

  const width = hasBounds ? Math.max(1, maxRight - minLeft) : 1;
  const height = hasBounds ? Math.max(1, maxBottom - minTop) : 1;
  const originX = hasBounds ? -minLeft : 0;
  const originY = hasBounds ? -minTop : 0;

  const frameOffsets = frames.map((frame) => {
    const sprite = spriteFor(frame);
    if (!sprite) return null;
    return { x: originX - sprite.axisX, y: originY - sprite.axisY };
  });

  return { width, height, frameOffsets };
}

/**
 * Draws `pixels` (a flat, row-major, straight-alpha RGBA sprite buffer) onto
 * a fresh `canvasWidth`x`canvasHeight` RGBA buffer at `(offsetX, offsetY)`,
 * transparent everywhere else. Pixels landing outside the canvas bounds are
 * clipped rather than throwing — `computeGifCanvasLayout` should never
 * produce an out-of-range offset, but this stays defensive against future
 * drift between the two functions.
 */
export function compositeFrameRgba(
  pixels: Uint8Array,
  spriteWidth: number,
  spriteHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  offsetX: number,
  offsetY: number,
): Uint8Array {
  const canvas = new Uint8Array(canvasWidth * canvasHeight * 4);
  for (let y = 0; y < spriteHeight; y++) {
    const cy = y + offsetY;
    if (cy < 0 || cy >= canvasHeight) continue;
    for (let x = 0; x < spriteWidth; x++) {
      const cx = x + offsetX;
      if (cx < 0 || cx >= canvasWidth) continue;
      const srcIndex = (y * spriteWidth + x) * 4;
      const dstIndex = (cy * canvasWidth + cx) * 4;
      const alpha = pixels[srcIndex + 3];
      // Zero out RGB on a fully transparent source pixel instead of
      // preserving whatever arbitrary color happened to sit behind it.
      // `applyPalette` (unlike `quantize`) matches nearest color on the raw
      // RGBA buffer with no alpha-aware "clear" step of its own — an
      // uncleared transparent pixel can tie-distance between the palette's
      // transparent entry and an unrelated opaque one, and lose the tie,
      // producing a visibly wrong-colored "transparent" pixel. Found via
      // real-browser/Pillow runtime verification, not caught by unit tests
      // alone (see docs/testing.md).
      canvas[dstIndex] = alpha === 0 ? 0 : pixels[srcIndex];
      canvas[dstIndex + 1] = alpha === 0 ? 0 : pixels[srcIndex + 1];
      canvas[dstIndex + 2] = alpha === 0 ? 0 : pixels[srcIndex + 2];
      canvas[dstIndex + 3] = alpha;
    }
  }
  return canvas;
}

/**
 * "Stand" is Animation number 0 by MUGEN/Ikemen GO's own engine convention
 * — see .vibe/decisions/016-stand-animation-identification-and-export-filenames.md
 * for why this, rather than a Statedef lookup, identifies it. `null` when
 * this character defines no Animation 0.
 */
export function resolveStandAnimation(
  character: CharacterData,
): Animation | null {
  return character.animations.find((a) => a.number === 0) ?? null;
}

/** Lowercases, strips anything but `[a-z0-9]` runs to a single `-`, and trims leading/trailing `-` — falls back to `"character"` if that leaves nothing. */
export function sanitizeForFilename(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "character";
}

/** `<sanitized character name>-<label>.gif`, e.g. `kfm-anim0.gif` / `kfm-stand.gif`. */
export function buildGifFilename(characterName: string, label: string): string {
  return `${sanitizeForFilename(characterName)}-${label}.gif`;
}

export type GifExportResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; error: string };

export interface EncodeAnimationGifOptions {
  /** Decodes sprite pixels. Defaults to the real WASM bridge; injectable for testing. */
  resolveSpritePixels?: (
    sffBytes: Uint8Array,
    requests: readonly (readonly [number, number])[],
    overridePaletteBytes: Uint8Array | null,
    options?: WasmBridgeOptions,
  ) => Promise<SpritePixelResult[]>;
  /** Forwarded to the default resolveSpritePixels; ignored if resolveSpritePixels is overridden. */
  bridgeOptions?: WasmBridgeOptions;
}

/**
 * Encodes one Animation as animated GIF bytes: resolves every referenced
 * sprite's pixels (batched, deduplicated, through the same WASM bridge call
 * the animation player itself uses) with `overridePaletteBytes` applied,
 * composites each onto the shared axis-aligned canvas, quantizes it to a
 * per-frame palette, and writes it with that frame's own tick-derived
 * duration. A blank frame (or one whose sprite this character's own sprite
 * list doesn't contain) is written as a single fully transparent color
 * instead of being decoded. Returns a clear error instead of throwing or
 * producing a broken/partial download.
 */
export async function encodeAnimationGif(
  sffBytes: Uint8Array,
  character: CharacterData,
  animation: Animation,
  overridePaletteBytes: Uint8Array | null,
  options: EncodeAnimationGifOptions = {},
): Promise<GifExportResult> {
  if (animation.frames.length === 0) {
    return { ok: false, error: "This animation has no frames to export." };
  }

  const spriteByKey = new Map<string, Sprite>();
  for (const group of character.sprites) {
    for (const sprite of group.sprites) {
      spriteByKey.set(`${sprite.group},${sprite.image}`, sprite);
    }
  }

  const layout = computeGifCanvasLayout(animation.frames, spriteByKey);
  const resolvePixels =
    options.resolveSpritePixels ?? defaultResolveSpritePixels;

  const requestKeys: string[] = [];
  const requests: [number, number][] = [];
  animation.frames.forEach((frame, index) => {
    if (layout.frameOffsets[index] === null) return;
    const key = `${frame.group},${frame.image}`;
    if (requestKeys.includes(key)) return; // already queued by an earlier frame
    requestKeys.push(key);
    requests.push([frame.group, frame.image]);
  });

  const resultByKey = new Map<string, SpritePixelResult>();
  if (requests.length > 0) {
    const results = await resolvePixels(
      sffBytes,
      requests,
      overridePaletteBytes,
      options.bridgeOptions,
    );
    const failed = results.find((result) => !result.ok);
    if (failed && !failed.ok) {
      return { ok: false, error: failed.error };
    }
    requests.forEach((request, index) => {
      resultByKey.set(`${request[0]},${request[1]}`, results[index]);
    });
  }

  const gif = GIFEncoder();
  animation.frames.forEach((frame, index) => {
    const delayMs = effectiveTickDuration(frame) * MS_PER_TICK;
    const offset = layout.frameOffsets[index];

    if (offset === null) {
      const blankIndex = new Uint8Array(layout.width * layout.height);
      gif.writeFrame(blankIndex, layout.width, layout.height, {
        palette: [[0, 0, 0, 0]],
        transparent: true,
        transparentIndex: 0,
        delay: delayMs,
      });
      return;
    }

    const result = resultByKey.get(`${frame.group},${frame.image}`);
    if (!result || !result.ok) {
      // Already validated above — a missing/failed entry here would be an
      // internal inconsistency, not a real user-facing case. Degrade to a
      // transparent frame rather than producing a corrupt GIF.
      const blankIndex = new Uint8Array(layout.width * layout.height);
      gif.writeFrame(blankIndex, layout.width, layout.height, {
        palette: [[0, 0, 0, 0]],
        transparent: true,
        transparentIndex: 0,
        delay: delayMs,
      });
      return;
    }

    const rgba = compositeFrameRgba(
      result.pixels,
      result.width,
      result.height,
      layout.width,
      layout.height,
      offset.x,
      offset.y,
    );
    const palette = quantize(rgba, 255, {
      format: "rgba4444",
      oneBitAlpha: true,
    });
    const paletteIndex = applyPalette(rgba, palette, "rgba4444");
    const transparentIndex = palette.findIndex((color) => color[3] === 0);

    gif.writeFrame(paletteIndex, layout.width, layout.height, {
      palette,
      delay: delayMs,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
    });
  });
  gif.finish();

  return { ok: true, bytes: gif.bytes() };
}

/**
 * Saves GIF bytes as a downloaded file via a Blob URL + a synthetic anchor
 * click — the real, browser-only implementation. jsdom implements neither
 * `URL.createObjectURL` nor a working anchor download, so tests inject a
 * stub instead, same pattern as `sprite-browser.ts`'s `drawPixels`.
 */
function defaultTriggerDownload(bytes: Uint8Array, filename: string): void {
  // `Uint8Array`'s `buffer` is typed as `ArrayBufferLike` (which also covers
  // `SharedArrayBuffer`), narrower than `Blob`'s `BlobPart`; gifenc's own
  // output is always backed by a plain `ArrayBuffer` at runtime.
  const blob = new Blob([bytes as unknown as BlobPart], { type: "image/gif" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export interface GifExportControlsOptions {
  /** Decodes sprite pixels. Defaults to the real WASM bridge; injectable for testing. */
  resolveSpritePixels?: EncodeAnimationGifOptions["resolveSpritePixels"];
  /** Forwarded to the default resolveSpritePixels; ignored if resolveSpritePixels is overridden. */
  bridgeOptions?: WasmBridgeOptions;
  /** Encodes an Animation to GIF bytes. Defaults to the real gifenc-based encoder; injectable for testing. */
  encodeAnimationGif?: typeof encodeAnimationGif;
  /** Saves the encoded bytes as a downloaded file. Defaults to the real Blob + anchor-click download; injectable for testing. */
  triggerDownload?: (bytes: Uint8Array, filename: string) => void;
}

/**
 * `renderGifExportControls` is only ever really invoked once per
 * `animation-player.ts` render, but tests call it repeatedly — torn down at
 * the top of every call, before a fresh one is made, so a locale-change
 * subscription from a previous call never accumulates or fires against
 * content no longer on the page. See
 * .vibe/decisions/019-i18n-integration-approach.md.
 */
let currentUnsubscribeLocaleChange: (() => void) | undefined;

/**
 * Appends the "Export GIF" / "Export Stand" controls into `container` —
 * unlike this app's `renderXxx(root, ...)` screens, this does not own or
 * clear `container`: it is a sub-widget mounted alongside
 * `animation-player.ts`'s own existing controls, reading that screen's
 * currently selected animation and active palette override through the
 * given getters at click time (not continuously), so a later selection/
 * palette change never affects an export already in flight.
 */
export function renderGifExportControls(
  container: HTMLElement,
  character: CharacterData,
  sffBytes: Uint8Array,
  getCurrentAnimation: () => Animation,
  getPaletteOverride: () => Uint8Array | null,
  options: GifExportControlsOptions = {},
): void {
  currentUnsubscribeLocaleChange?.();
  currentUnsubscribeLocaleChange = undefined;
  const encode = options.encodeAnimationGif ?? encodeAnimationGif;
  const triggerDownload = options.triggerDownload ?? defaultTriggerDownload;

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "animation-player__export-gif";
  exportButton.textContent = t("gifExport.exportGifButton", "Export GIF");

  const exportStandButton = document.createElement("button");
  exportStandButton.type = "button";
  exportStandButton.className = "animation-player__export-stand";
  exportStandButton.textContent = t(
    "gifExport.exportStandButton",
    "Export Stand",
  );

  const status = document.createElement("p");
  status.className = "animation-player__export-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  container.append(exportButton, exportStandButton, status);

  // The status line's current content, as data rather than a pre-formatted
  // string — retranslated in place on a locale change; a raw WASM/bridge
  // encode error is left untouched. `label`/`filename` are the same values
  // already threaded through `performExport`/`buildGifFilename` below, never
  // recomputed independently.
  type ExportStatus =
    | { kind: "idle" }
    | { kind: "encoding"; label: string }
    | { kind: "exported"; filename: string }
    | { kind: "no-stand" }
    | { kind: "error"; message: string };
  let exportStatus: ExportStatus = { kind: "idle" };

  function renderStatus(): void {
    switch (exportStatus.kind) {
      case "idle":
        status.textContent = "";
        status.className = "animation-player__export-status";
        return;
      case "encoding":
        status.textContent = t("gifExport.encoding", "Encoding {{label}}…", {
          label: exportStatus.label,
        });
        status.className = "animation-player__export-status";
        return;
      case "exported":
        status.textContent = t("gifExport.exported", "Exported {{filename}}.", {
          filename: exportStatus.filename,
        });
        status.className = "animation-player__export-status";
        return;
      case "no-stand":
        status.textContent = t(
          "gifExport.noStandAnimation",
          'No "Stand" animation (Animation 0) found for this character.',
        );
        status.className =
          "animation-player__export-status animation-player__export-status--error";
        return;
      case "error":
        status.textContent = exportStatus.message;
        status.className =
          "animation-player__export-status animation-player__export-status--error";
        return;
    }
  }

  function showError(message: string): void {
    exportStatus = { kind: "error", message };
    renderStatus();
  }

  async function performExport(
    animation: Animation,
    filenameLabel: string,
    statusLabel: string,
  ): Promise<void> {
    exportButton.disabled = true;
    exportStandButton.disabled = true;
    exportStatus = { kind: "encoding", label: statusLabel };
    renderStatus();

    // Yield once so the "Encoding…" status actually paints before the
    // encode's own (potentially blocking) work starts — see the frontend
    // design/UI-UX expert consultation for backlog item 014.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    try {
      const result = await encode(
        sffBytes,
        character,
        animation,
        getPaletteOverride(),
        {
          resolveSpritePixels: options.resolveSpritePixels,
          bridgeOptions: options.bridgeOptions,
        },
      );
      if (!result.ok) {
        showError(result.error);
        return;
      }
      const filename = buildGifFilename(character.name, filenameLabel);
      triggerDownload(result.bytes, filename);
      exportStatus = { kind: "exported", filename };
      renderStatus();
    } catch (err: unknown) {
      // A rejected promise (e.g. the WASM bridge itself failing to load)
      // degrades to the same clear error status as an ok:false result,
      // never a silent crash or an unhandled rejection.
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      exportButton.disabled = false;
      exportStandButton.disabled = false;
    }
  }

  exportButton.addEventListener("click", () => {
    const animation = getCurrentAnimation();
    void performExport(
      animation,
      `anim${animation.number}`,
      t("animationPlayer.animationOption", "Animation {{number}}", {
        number: String(animation.number),
      }),
    );
  });

  exportStandButton.addEventListener("click", () => {
    const animation = resolveStandAnimation(character);
    if (animation === null) {
      exportStatus = { kind: "no-stand" };
      renderStatus();
      return;
    }
    void performExport(animation, "stand", t("gifExport.standLabel", "Stand"));
  });

  // Live locale switching (backlog item 018): the two static button labels
  // always retranslate; the status line is recomputed from `exportStatus`
  // (never a pre-formatted string), so an in-progress "Encoding…"/already
  // "Exported" message retranslates too — a raw WASM/bridge encode error is
  // left untouched.
  currentUnsubscribeLocaleChange = onLocaleChange(() => {
    exportButton.textContent = t("gifExport.exportGifButton", "Export GIF");
    exportStandButton.textContent = t(
      "gifExport.exportStandButton",
      "Export Stand",
    );
    renderStatus();
  });
}
