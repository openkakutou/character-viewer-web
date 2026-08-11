// The sprite browser (backlog item 005): browse every sprite group/image of
// a loaded character and see its actual decoded pixels. Sprite pixel data
// is never part of `CharacterData` (metadata only — see wasm/types.ts), so
// decoding happens on demand, one sprite at a time, via the WASM bridge's
// separate resolveSpritePixels call and the raw `.sff` bytes threaded
// through from the file input (.vibe/decisions/006). The preview uses a
// plain <canvas> with a locally-computed scale-to-fit rather than
// web-ui-kit's `<wuik-viewport>` — that control isn't actually installable
// yet, see .vibe/decisions/007-sprite-preview-raw-canvas-not-wuik-viewport.md.
import {
  type SpritePixelResult,
  type WasmBridgeOptions,
  resolveSpritePixels as defaultResolveSpritePixels,
} from "../wasm/bridge.ts";
import type { CharacterData, Sprite, SpriteGroup } from "../wasm/types.ts";

/** Preview stage size (px) the scale-to-fit math targets — see computeScaleToFit. */
const PREVIEW_TARGET_PX = 240;
/** Never upscale a tiny sprite past this factor — an 8x-blown-up 1px sprite is still not "readable", just blocky. */
const MAX_UPSCALE = 8;

/**
 * Scale factor (applied via CSS, never touching the pixel buffer) that fits
 * a `width`x`height` sprite into the preview stage: downscales a sprite
 * larger than the stage to fit it, upscales one smaller than it — capped at
 * `MAX_UPSCALE` — so a handful-of-pixels icon isn't visually
 * indistinguishable from nothing having loaded. `width`/`height` of 0 (a
 * degenerate/corrupt sprite) returns 1 rather than a non-finite scale.
 */
export function computeScaleToFit(width: number, height: number): number {
  const largestSide = Math.max(width, height);
  if (largestSide <= 0) return 1;
  return Math.min(PREVIEW_TARGET_PX / largestSide, MAX_UPSCALE);
}

/**
 * Draws `pixels` (a flat, row-major RGBA buffer, straight alpha) onto
 * `canvas` at their native resolution. The real, browser-only
 * implementation — tests inject a stub instead, since jsdom does not
 * implement `HTMLCanvasElement.getContext("2d")` at all.
 */
function defaultDrawPixels(
  canvas: HTMLCanvasElement,
  pixels: Uint8Array,
  width: number,
  height: number,
): void {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(pixels), width, height),
    0,
    0,
  );
}

export interface SpriteBrowserOptions {
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
 * Renders the sprite browser into `root`, replacing its previous content
 * (and any in-flight selection state) entirely. `character === null` or
 * `sffBytes === null` (nothing loaded yet) renders nothing, mirroring the
 * characteristics panel's convention.
 */
export function renderSpriteBrowser(
  root: HTMLElement,
  character: CharacterData | null,
  sffBytes: Uint8Array | null,
  options: SpriteBrowserOptions = {},
): void {
  root.replaceChildren();
  if (character === null || sffBytes === null) return;
  // Narrowed into a fresh binding: TS does not carry a parameter's narrowed
  // type into a nested closure (selectSprite, below) since it can't prove
  // the parameter isn't reassigned before the closure runs.
  const sffBytesNonNull: Uint8Array = sffBytes;

  const resolvePixels =
    options.resolveSpritePixels ?? defaultResolveSpritePixels;
  const drawPixels = options.drawPixels ?? defaultDrawPixels;

  const totalSpriteCount = character.sprites.reduce(
    (sum, group) => sum + group.sprites.length,
    0,
  );

  const panel = document.createElement("wuik-panel");
  panel.className = "sprite-browser";

  const heading = document.createElement("h3");
  heading.textContent = `Sprites (${totalSpriteCount})`;
  panel.appendChild(heading);

  if (totalSpriteCount === 0) {
    const empty = document.createElement("p");
    empty.className = "sprite-browser__empty";
    empty.textContent = "No sprites found.";
    panel.appendChild(empty);
    root.appendChild(panel);
    return;
  }

  const body = document.createElement("div");
  body.className = "sprite-browser__body";

  const list = document.createElement("div");
  list.className = "sprite-browser__list";

  const preview = document.createElement("div");
  preview.className = "sprite-browser__preview";

  const stage = document.createElement("div");
  stage.className = "sprite-browser__stage";
  const canvas = document.createElement("canvas");
  canvas.className = "sprite-browser__canvas";
  stage.appendChild(canvas);

  const status = document.createElement("p");
  status.className = "sprite-browser__preview-status";

  preview.append(stage, status);

  // Guards against a slower, superseded decode overwriting a newer
  // selection's preview: only the response matching the *current* token is
  // ever applied.
  let selectionToken = 0;
  let selectedButton: HTMLButtonElement | null = null;

  function selectSprite(sprite: Sprite, button: HTMLButtonElement): void {
    selectedButton?.removeAttribute("aria-current");
    selectedButton = button;
    button.setAttribute("aria-current", "true");

    const token = ++selectionToken;
    canvas.hidden = true;
    status.textContent = "Loading…";
    status.classList.remove("sprite-browser__preview-status--error");

    resolvePixels(
      sffBytesNonNull,
      [[sprite.group, sprite.image]],
      null,
      options.bridgeOptions,
    ).then(([result]) => {
      if (token !== selectionToken) return; // superseded by a later selection

      if (!result.ok) {
        canvas.hidden = true;
        status.textContent = result.error;
        status.classList.add("sprite-browser__preview-status--error");
        return;
      }

      const scale = computeScaleToFit(result.width, result.height);
      canvas.style.width = `${result.width * scale}px`;
      canvas.style.height = `${result.height * scale}px`;
      drawPixels(canvas, result.pixels, result.width, result.height);
      canvas.hidden = false;
      status.textContent = "";
    });
  }

  for (const group of character.sprites) {
    const groupEl = document.createElement("div");
    groupEl.className = "sprite-browser__group";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "sprite-browser__group-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = `Group ${group.index} (${group.sprites.length})`;

    const spriteList = document.createElement("div");
    spriteList.className = "sprite-browser__sprites";
    spriteList.hidden = true;

    let expanded = false;
    let mounted = false;
    toggle.addEventListener("click", () => {
      expanded = !expanded;
      toggle.setAttribute("aria-expanded", String(expanded));
      spriteList.hidden = !expanded;
      if (expanded && !mounted) {
        mounted = true;
        mountSprites(group, spriteList, selectSprite);
      }
    });

    groupEl.append(toggle, spriteList);
    list.appendChild(groupEl);
  }

  body.append(list, preview);
  panel.appendChild(body);
  root.appendChild(panel);
}

function mountSprites(
  group: SpriteGroup,
  container: HTMLElement,
  onSelect: (sprite: Sprite, button: HTMLButtonElement) => void,
): void {
  for (const sprite of group.sprites) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sprite-browser__sprite";
    button.textContent = `${sprite.group}, ${sprite.image} — ${sprite.width}×${sprite.height}`;
    button.addEventListener("click", () => onSelect(sprite, button));
    container.appendChild(button);
  }
}
