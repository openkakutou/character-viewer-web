// The sprite browser (backlog item 005): browse every sprite group/image of
// a loaded character and see its actual decoded pixels. Sprite pixel data
// is never part of `CharacterData` (metadata only — see wasm/types.ts), so
// decoding happens on demand, one sprite at a time, via the WASM bridge's
// separate resolveSpritePixels call and the raw `.sff` bytes threaded
// through from the file input (.vibe/decisions/006). The preview canvas is
// wrapped in web-ui-kit's `<wuik-viewport>` for zoom/pan/reset-to-fit
// (backlog item 016, .vibe/decisions/018) — that control was not
// installable when this screen first shipped, so it used a local
// scale-to-fit instead (.vibe/decisions/007, now superseded). That local
// scale-to-fit, `computeScaleToFit`, stays exported here for the animation
// player (animation-player.ts, item 007), which still uses it for its own
// preview and is out of item 016's scope.
import { onLocaleChange, t } from "../i18n/i18n.ts";
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
 * implement `HTMLCanvasElement.getContext("2d")` at all. Exported so other
 * preview panels (e.g. the animation player, item 007) can reuse the same
 * default instead of duplicating it.
 */
export function defaultDrawPixels(
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

/**
 * Calls a `<wuik-viewport>` element's `resetToFit()` if it's actually the
 * real, registered custom element — a plain jsdom `HTMLElement` (this
 * project's test environment never registers `@openkakutou/web-ui-kit`'s
 * custom elements) has no such method, so this is a silent no-op there;
 * the real behavior is verified by a real-browser runtime pass instead.
 */
function resetViewportToFit(viewport: HTMLElement): void {
  (viewport as unknown as { resetToFit?: () => void }).resetToFit?.();
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

/** Returned by `renderSpriteBrowser` so a caller (the palette picker) can push a new palette override without a full re-render, preserving the current selection/expanded groups. */
export interface SpriteBrowserHandle {
  /** Re-resolves the currently selected sprite (if any) with `overridePaletteBytes`, and applies it to every future selection until changed again. */
  setPaletteOverride(overridePaletteBytes: Uint8Array | null): void;
}

const noopHandle: SpriteBrowserHandle = { setPaletteOverride() {} };

/**
 * `renderSpriteBrowser` is only ever really invoked once per session, but
 * tests call it repeatedly — torn down at the top of every call, before a
 * fresh one is made, so a locale-change subscription from a previous call
 * never accumulates or fires against content no longer on the page. See
 * .vibe/decisions/019-i18n-integration-approach.md.
 */
let currentUnsubscribeLocaleChange: (() => void) | undefined;

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
): SpriteBrowserHandle {
  currentUnsubscribeLocaleChange?.();
  currentUnsubscribeLocaleChange = undefined;
  root.replaceChildren();
  if (character === null || sffBytes === null) return noopHandle;
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
  heading.textContent = t("spriteBrowser.heading", "Sprites ({{count}})", {
    count: String(totalSpriteCount),
  });
  panel.appendChild(heading);

  if (totalSpriteCount === 0) {
    const empty = document.createElement("p");
    empty.className = "sprite-browser__empty";
    empty.textContent = t("spriteBrowser.empty", "No sprites found.");
    panel.appendChild(empty);
    root.appendChild(panel);
    return noopHandle;
  }

  const body = document.createElement("div");
  body.className = "sprite-browser__body";

  const list = document.createElement("div");
  list.className = "sprite-browser__list";

  const preview = document.createElement("div");
  preview.className = "sprite-browser__preview";

  const viewport = document.createElement("wuik-viewport");
  viewport.className = "sprite-browser__viewport";
  const canvas = document.createElement("canvas");
  canvas.className = "sprite-browser__canvas";
  canvas.hidden = true;
  viewport.appendChild(canvas);

  const status = document.createElement("p");
  status.className = "sprite-browser__preview-status";

  preview.append(viewport, status);

  // Guards against a slower, superseded decode overwriting a newer
  // selection's preview: only the response matching the *current* token is
  // ever applied.
  let selectionToken = 0;
  let selectedButton: HTMLButtonElement | null = null;
  // The palette picker's active override, if any — applied to every
  // resolve from here on. Re-resolving the last selection (rather than a
  // full re-render) is how `setPaletteOverride` reflects a palette change
  // without losing which group is expanded or which sprite is selected.
  let activeOverride: Uint8Array | null = null;
  let lastSelected: { sprite: Sprite; button: HTMLButtonElement } | null = null;
  // Whether `status` is currently showing this module's own translatable
  // "Loading…" text — retranslated on a locale change; an error (raw, from
  // the WASM bridge) or the empty "shown" state is left untouched.
  let previewStatusKind: "idle" | "loading" | "error" | "shown" = "idle";

  function selectSprite(sprite: Sprite, button: HTMLButtonElement): void {
    selectedButton?.removeAttribute("aria-current");
    selectedButton = button;
    button.setAttribute("aria-current", "true");
    lastSelected = { sprite, button };

    const token = ++selectionToken;
    canvas.hidden = true;
    previewStatusKind = "loading";
    status.textContent = t("spriteBrowser.loading", "Loading…");
    status.classList.remove("sprite-browser__preview-status--error");

    resolvePixels(
      sffBytesNonNull,
      [[sprite.group, sprite.image]],
      activeOverride,
      options.bridgeOptions,
    ).then(([result]) => {
      if (token !== selectionToken) return; // superseded by a later selection

      if (!result.ok) {
        canvas.hidden = true;
        previewStatusKind = "error";
        status.textContent = result.error;
        status.classList.add("sprite-browser__preview-status--error");
        return;
      }

      drawPixels(canvas, result.pixels, result.width, result.height);
      canvas.hidden = false;
      previewStatusKind = "shown";
      status.textContent = "";
      resetViewportToFit(viewport);
    });
  }

  const groupToggles: Array<{
    toggle: HTMLButtonElement;
    index: number;
    count: number;
  }> = [];

  for (const group of character.sprites) {
    const groupEl = document.createElement("div");
    groupEl.className = "sprite-browser__group";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "sprite-browser__group-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = t(
      "spriteBrowser.groupToggle",
      "Group {{index}} ({{count}})",
      { index: String(group.index), count: String(group.sprites.length) },
    );
    groupToggles.push({
      toggle,
      index: group.index,
      count: group.sprites.length,
    });

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

  // Live locale switching (backlog item 018): the heading, every group
  // toggle's label, and the preview status (only while it's showing this
  // module's own translatable "Loading…" text) retranslate in place —
  // expanded/selected state and an in-flight decode are untouched.
  currentUnsubscribeLocaleChange = onLocaleChange(() => {
    heading.textContent = t("spriteBrowser.heading", "Sprites ({{count}})", {
      count: String(totalSpriteCount),
    });
    for (const entry of groupToggles) {
      entry.toggle.textContent = t(
        "spriteBrowser.groupToggle",
        "Group {{index}} ({{count}})",
        { index: String(entry.index), count: String(entry.count) },
      );
    }
    if (previewStatusKind === "loading") {
      status.textContent = t("spriteBrowser.loading", "Loading…");
    }
  });

  return {
    setPaletteOverride(overridePaletteBytes) {
      activeOverride = overridePaletteBytes;
      if (lastSelected) selectSprite(lastSelected.sprite, lastSelected.button);
    },
  };
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
