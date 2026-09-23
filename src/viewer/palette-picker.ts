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
import { onLocaleChange, t } from "../i18n/i18n.ts";
import { readFileAsBytes } from "../input/character-file-input.ts";
import { createInfoTooltip } from "../preferences/info-tooltip.ts";
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
 * `renderPalettePicker` is only ever really invoked once per session, but
 * tests call it repeatedly — torn down at the top of every call, before a
 * fresh one is made, so a locale-change subscription from a previous call
 * never accumulates or fires against content no longer on the page. See
 * .vibe/decisions/019-i18n-integration-approach.md.
 */
let currentUnsubscribeLocaleChange: (() => void) | undefined;
/** Same "torn down at top of every call" shape, for the beginner-mode tooltip's own subscription (backlog item 022). */
let currentDestroyOverrideTooltip: (() => void) | undefined;

function formatReferenced(character: CharacterData): string {
  const count = character.palettes.length;
  if (count === 0) {
    return t(
      "palettePicker.referencedNone",
      "This character references no external palette files.",
    );
  }
  const noun = t(
    count === 1
      ? "palettePicker.paletteFileSingular"
      : "palettePicker.paletteFilePlural",
    count === 1 ? "palette file" : "palette files",
  );
  return t(
    "palettePicker.referencedSome",
    "This character references {{count}} {{noun}} for player-color variants: {{names}}. Upload one below to preview it.",
    { count: String(count), noun, names: character.palettes.join(", ") },
  );
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
  currentUnsubscribeLocaleChange?.();
  currentUnsubscribeLocaleChange = undefined;
  currentDestroyOverrideTooltip?.();
  currentDestroyOverrideTooltip = undefined;
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
  heading.textContent = t("palettePicker.heading", "Palette");
  panel.appendChild(heading);

  const referenced = document.createElement("p");
  referenced.className = "palette-picker__referenced";
  referenced.textContent = formatReferenced(characterNonNull);
  panel.appendChild(referenced);

  const uploadLabel = document.createElement("label");
  uploadLabel.className = "palette-picker__upload-label";
  uploadLabel.textContent = t(
    "palettePicker.uploadLabel",
    "Load palette override (.act)",
  );
  // Kept as its own reference: the input is appended as a sibling node
  // right after it, so this label's own text can't simply be reset via
  // `uploadLabel.textContent = ...` again later without also destroying
  // (and needing to re-append) that child input.
  const uploadLabelText = uploadLabel.firstChild;
  const uploadInput = document.createElement("input");
  uploadInput.type = "file";
  uploadInput.accept = ".act";
  uploadInput.className = "palette-picker__upload-input";
  uploadLabel.appendChild(uploadInput);

  const uploadRow = document.createElement("div");
  uploadRow.className = "palette-picker__upload-row";
  uploadRow.appendChild(uploadLabel);
  // Beginner-mode tooltip (backlog item 022): explains what a palette
  // override is -- a sibling of the label, not nested inside it, so the
  // icon's own click doesn't also activate the label's wrapped file input.
  const overrideTooltip = createInfoTooltip(
    t(
      "palettePicker.tooltipOverrideText",
      "An external color table (.act file) you upload, applied to every sprite in place of the character's own colors.",
    ),
    t("palettePicker.tooltipOverrideLabel", "What is a palette override?"),
  );
  uploadRow.appendChild(overrideTooltip.element);
  panel.appendChild(uploadRow);
  currentDestroyOverrideTooltip = overrideTooltip.destroy;

  const status = document.createElement("p");
  status.className = "palette-picker__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const resetButton = document.createElement("wuik-button");
  resetButton.setAttribute("variant", "secondary");
  resetButton.dataset.action = "reset-palette";
  resetButton.textContent = t(
    "palettePicker.resetButton",
    "Reset to character's own palette",
  );

  panel.append(status, resetButton);
  root.appendChild(panel);

  let activeFileName: string | null = null;
  let requestToken = 0;
  // Whether `status` is currently showing one of this module's own
  // translatable texts ("idle" — using-own/active-override, computed from
  // `activeFileName` — or "checking") — retranslated on a locale change; a
  // raw WASM/bridge probe error is left untouched.
  let statusKind: "idle" | "checking" | "read-error" | "raw" = "idle";

  function refreshStatusAndReset(): void {
    statusKind = "idle";
    status.textContent = activeFileName
      ? t(
          "palettePicker.statusActiveOverride",
          "Active palette override: {{fileName}}.",
          {
            fileName: activeFileName,
          },
        )
      : t("palettePicker.statusUsingOwn", "Using each sprite's own palette.");
    resetButton.toggleAttribute("disabled", activeFileName === null);
  }
  refreshStatusAndReset();

  async function handleUpload(file: File): Promise<void> {
    const token = ++requestToken;
    statusKind = "checking";
    status.textContent = t("palettePicker.statusChecking", "Checking…");

    let bytes: Uint8Array;
    try {
      bytes = await readFileBytes(file);
    } catch {
      if (token !== requestToken) return;
      statusKind = "read-error";
      status.textContent = t(
        "palettePicker.errorReadFile",
        "Could not read the selected file.",
      );
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
      statusKind = "raw";
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

  // Live locale switching (backlog item 018): static labels always
  // retranslate; the status line only retranslates when it's currently
  // showing this module's own translatable text ("idle"/"checking"/
  // "read-error") — a raw WASM/bridge probe error is left untouched.
  currentUnsubscribeLocaleChange = onLocaleChange(() => {
    heading.textContent = t("palettePicker.heading", "Palette");
    referenced.textContent = formatReferenced(characterNonNull);
    if (uploadLabelText) {
      uploadLabelText.textContent = t(
        "palettePicker.uploadLabel",
        "Load palette override (.act)",
      );
    }
    resetButton.textContent = t(
      "palettePicker.resetButton",
      "Reset to character's own palette",
    );
    overrideTooltip.setText(
      t(
        "palettePicker.tooltipOverrideText",
        "An external color table (.act file) you upload, applied to every sprite in place of the character's own colors.",
      ),
      t("palettePicker.tooltipOverrideLabel", "What is a palette override?"),
    );
    if (statusKind === "idle") {
      refreshStatusAndReset();
    } else if (statusKind === "checking") {
      status.textContent = t("palettePicker.statusChecking", "Checking…");
    } else if (statusKind === "read-error") {
      status.textContent = t(
        "palettePicker.errorReadFile",
        "Could not read the selected file.",
      );
    }
  });
}
