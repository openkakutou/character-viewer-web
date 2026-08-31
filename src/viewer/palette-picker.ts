// The palette picker (backlog item 006): shows which `.act` palette files
// this character's `.def` references (informational only — this app never
// has their bytes, see below), and lets the user upload an external `.act`
// file to recolor the sprite browser/animation player's current preview.
// Only one recoloring mechanism the `character` WASM bridge actually
// supports is used: a single external palette override applied uniformly
// to whatever sprite is resolved next — there is no way to select an
// arbitrary *other* embedded palette bank without supplying real bytes for
// it, since this app only loads the 4 required character files, never any
// referenced `.act` file. See
// .vibe/decisions/010-palette-picker-scope-and-external-override-only.md.
import { readFileAsBytes } from "../input/character-file-input.ts";
import {
  type SpritePixelResult,
  type WasmBridgeOptions,
  resolveSpritePixels as defaultResolveSpritePixels,
} from "../wasm/bridge.ts";
import type { CharacterData } from "../wasm/types.ts";

export interface PalettePickerOptions {
  /** Called with the newly validated override bytes, or `null` on reset — the caller (`app`) forwards this to the sprite browser's and animation player's own `setPaletteOverride`. */
  onPaletteChange: (overridePaletteBytes: Uint8Array | null) => void;
  /** Reads the uploaded File's bytes. Defaults to the real FileReader-based read; injectable for testing. */
  readFileBytes?: (file: File) => Promise<Uint8Array>;
  /** Probe-resolves the uploaded bytes against a real sprite to validate them. Defaults to the real WASM bridge; injectable for testing. */
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
 * Renders the palette picker into `root`, replacing its previous content
 * (and any in-flight upload state) entirely. `character === null` or
 * `sffBytes === null` (nothing loaded yet) renders nothing, mirroring the
 * sprite browser's own convention.
 */
export function renderPalettePicker(
  root: HTMLElement,
  character: CharacterData | null,
  sffBytes: Uint8Array | null,
  options: PalettePickerOptions,
): void {
  root.replaceChildren();
  if (character === null || sffBytes === null) return;
  const sffBytesNonNull: Uint8Array = sffBytes;
  const characterNonNull: CharacterData = character;

  const readFileBytes = options.readFileBytes ?? readFileAsBytes;
  const resolvePixels =
    options.resolveSpritePixels ?? defaultResolveSpritePixels;

  // The first real sprite (if any) this character's own data offers, used
  // to probe-validate an uploaded override before accepting it — see the
  // ADR for why a probe-resolve, not a byte-length check.
  const probeSprite = characterNonNull.sprites[0]?.sprites[0] ?? null;

  const panel = document.createElement("wuik-panel");
  panel.className = "palette-picker";

  const heading = document.createElement("h3");
  heading.textContent = "Palette";
  panel.appendChild(heading);

  const referenced = document.createElement("p");
  referenced.className = "palette-picker__referenced";
  referenced.textContent =
    characterNonNull.palettes.length === 0
      ? "This character references no external palette files."
      : `This character references ${characterNonNull.palettes.length} palette file${characterNonNull.palettes.length === 1 ? "" : "s"} for player-color variants: ${characterNonNull.palettes.join(", ")}. Upload one below to preview it.`;
  panel.appendChild(referenced);

  const uploadLabel = document.createElement("label");
  uploadLabel.className = "palette-picker__upload-label";
  uploadLabel.textContent = "Load palette override (.act)";
  const uploadInput = document.createElement("input");
  uploadInput.type = "file";
  uploadInput.accept = ".act";
  uploadInput.className = "palette-picker__upload-input";
  uploadLabel.appendChild(uploadInput);
  panel.appendChild(uploadLabel);

  const status = document.createElement("p");
  status.className = "palette-picker__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const resetButton = document.createElement("wuik-button");
  resetButton.setAttribute("variant", "secondary");
  resetButton.dataset.action = "reset-palette";
  resetButton.textContent = "Reset to character's own palette";

  panel.append(status, resetButton);
  root.appendChild(panel);

  let activeFileName: string | null = null;
  let requestToken = 0;

  function refreshStatusAndReset(): void {
    status.textContent = activeFileName
      ? `Active palette override: ${activeFileName}.`
      : "Using each sprite's own palette.";
    resetButton.toggleAttribute("disabled", activeFileName === null);
  }
  refreshStatusAndReset();

  async function handleUpload(file: File): Promise<void> {
    const token = ++requestToken;
    status.textContent = "Checking…";

    let bytes: Uint8Array;
    try {
      bytes = await readFileBytes(file);
    } catch {
      if (token !== requestToken) return;
      status.textContent = "Could not read the selected file.";
      return;
    }
    if (token !== requestToken) return; // superseded by a later upload

    if (probeSprite === null) {
      // Nothing to probe-validate against — accept optimistically, the
      // sprite browser/animation player will surface a decode error later
      // if it's actually malformed once something is shown with it.
      activeFileName = file.name;
      options.onPaletteChange(bytes);
      refreshStatusAndReset();
      return;
    }

    const [result] = await resolvePixels(
      sffBytesNonNull,
      [[probeSprite.group, probeSprite.image]],
      bytes,
      options.bridgeOptions,
    );
    if (token !== requestToken) return; // superseded by a later upload

    if (!result.ok) {
      status.textContent = result.error;
      return; // active override (if any) is left unchanged
    }

    activeFileName = file.name;
    options.onPaletteChange(bytes);
    refreshStatusAndReset();
  }

  uploadInput.addEventListener("change", () => {
    const file = uploadInput.files?.[0];
    // Reset the input's own value so re-selecting the exact same file still
    // fires a future "change" event instead of being a silent no-op.
    uploadInput.value = "";
    if (!file) return;
    void handleUpload(file);
  });

  resetButton.addEventListener("click", () => {
    if (activeFileName === null) return;
    requestToken++; // discard any in-flight upload's result
    activeFileName = null;
    options.onPaletteChange(null);
    refreshStatusAndReset();
  });
}
