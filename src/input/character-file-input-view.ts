// DOM component for backlog item 003 (character file input): a
// keyboard/screen-reader-first file picker plus a drag-and-drop zone,
// both feeding the same accumulating slots from ./character-file-input.ts.
// See .vibe/decisions/004-character-file-input-interaction-model.md for
// the interaction model (accumulation across gestures, per-slot error
// attribution, same-gesture duplicate detection) this view renders.
import type { CharacterData } from "../wasm/types.ts";
import {
  type CharacterFileInputOptions,
  EXTENSION_BY_KIND,
  type FileSlots,
  REQUIRED_FILE_KINDS,
  type RequiredFileKind,
  isComplete,
  loadCharacterFromSlots,
  mergeFiles,
} from "./character-file-input.ts";

export interface CharacterFileInputViewOptions {
  /**
   * Called once the 4 required files have been read and the character
   * successfully loaded. `sffBytes` is the same raw `.sff` bytes just read,
   * threaded through for a caller that needs to decode a specific sprite's
   * pixels later (`resolveSpritePixels`) — `character`'s own metadata never
   * carries pixel data.
   */
  onLoaded: (character: CharacterData, sffBytes: Uint8Array) => void;
  /** Forwarded to the file-reading/WASM bridge layer; injectable for testing. */
  bridgeOptions?: CharacterFileInputOptions;
}

/**
 * Renders the character file input into `root`, replacing its previous
 * content. The native file input stays a first-class, fully keyboard- and
 * screen-reader-operable control alongside the drag-and-drop zone — not a
 * drag-and-drop fallback.
 */
export function renderCharacterFileInput(
  root: HTMLElement,
  options: CharacterFileInputViewOptions,
): void {
  root.replaceChildren();

  let slots: FileSlots = {};
  const slotErrors: Partial<Record<RequiredFileKind, string>> = {};
  let ignored: string[] = [];
  let phase: "collecting" | "loading" | "success" = "collecting";
  let bridgeErrorMessage: string | null = null;
  let loadedCharacterName: string | null = null;
  let acceptedFileNames: string[] = [];

  const panel = document.createElement("wuik-panel");
  panel.className = "file-input";

  const dropZone = document.createElement("div");
  dropZone.className = "file-input__dropzone";

  const label = document.createElement("label");
  label.className = "file-input__label";
  label.htmlFor = "character-file-picker";
  label.textContent = "Select the 4 character files (.def, .air, .sff, .cns)";

  const picker = document.createElement("input");
  picker.type = "file";
  picker.id = "character-file-picker";
  picker.multiple = true;
  picker.accept = REQUIRED_FILE_KINDS.map(
    (kind) => EXTENSION_BY_KIND[kind],
  ).join(",");

  const hint = document.createElement("p");
  hint.className = "file-input__hint";
  hint.textContent = "…or drag and drop them here";

  dropZone.append(label, picker, hint);

  const slotList = document.createElement("ul");
  slotList.className = "file-input__slots";
  slotList.setAttribute("aria-live", "polite");

  const ignoredNotice = document.createElement("p");
  ignoredNotice.className = "file-input__ignored";
  ignoredNotice.hidden = true;

  const status = document.createElement("div");
  status.className = "file-input__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  panel.append(dropZone, slotList, ignoredNotice, status);
  root.appendChild(panel);

  function render(): void {
    dropZone.classList.toggle(
      "file-input__dropzone--loading",
      phase === "loading",
    );
    picker.disabled = phase === "loading";

    slotList.replaceChildren(
      ...REQUIRED_FILE_KINDS.map((kind) => {
        const item = document.createElement("li");
        item.className = "file-input__slot";
        item.dataset.kind = kind;

        const file = slots[kind];
        const error = slotErrors[kind];
        item.classList.toggle("file-input__slot--filled", Boolean(file));
        item.classList.toggle("file-input__slot--error", Boolean(error));

        const kindLabel = document.createElement("span");
        kindLabel.className = "file-input__slot-kind";
        kindLabel.textContent = EXTENSION_BY_KIND[kind];

        const value = document.createElement("span");
        value.className = "file-input__slot-value";
        value.textContent = file ? file.name : "Missing";

        item.append(kindLabel, value);

        if (error) {
          const errorEl = document.createElement("span");
          errorEl.className = "file-input__slot-error-text";
          errorEl.textContent = error;
          item.appendChild(errorEl);
        }

        return item;
      }),
    );

    if (ignored.length > 0) {
      ignoredNotice.textContent = `Ignored (unrecognized file type): ${ignored.join(", ")}`;
      ignoredNotice.hidden = false;
    } else {
      ignoredNotice.textContent = "";
      ignoredNotice.hidden = true;
    }

    if (phase === "loading") {
      status.textContent = "Loading character…";
    } else if (phase === "success") {
      status.textContent = `Character loaded: ${loadedCharacterName} (files: ${acceptedFileNames.join(", ")})`;
    } else if (bridgeErrorMessage) {
      status.textContent = `Could not load character: ${bridgeErrorMessage}`;
    } else {
      status.textContent = "";
    }
  }

  async function tryAutoLoad(): Promise<void> {
    if (!isComplete(slots)) return;

    phase = "loading";
    bridgeErrorMessage = null;
    render();

    const result = await loadCharacterFromSlots(slots, options.bridgeOptions);

    if (result.status === "success") {
      phase = "success";
      loadedCharacterName = result.character.name;
      acceptedFileNames = REQUIRED_FILE_KINDS.map(
        (kind) => slots[kind]?.name ?? "",
      );
      render();
      options.onLoaded(result.character, result.sffBytes);
      return;
    }

    if (result.status === "read-error") {
      // Drop just the offending slot so the user can re-supply that one
      // file without losing the other 3 already-good ones.
      delete slots[result.error.kind];
      slotErrors[result.error.kind] = result.error.message;
      phase = "collecting";
      render();
      return;
    }

    // bridge-error: nothing file-specific to blame, so all 4 slots stay
    // filled — the user retries by re-dropping any file, which triggers a
    // fresh attempt.
    phase = "collecting";
    bridgeErrorMessage = result.message;
    render();
  }

  function handleIncomingFiles(files: File[]): void {
    if (files.length === 0) return;

    const previousSlots = slots;
    const merged = mergeFiles(slots, files);
    slots = merged.slots;
    ignored = merged.ignored.map((file) => file.name);
    bridgeErrorMessage = null;

    for (const duplicate of merged.duplicates) {
      slotErrors[duplicate.kind] =
        `Two files given for ${EXTENSION_BY_KIND[duplicate.kind]}: ` +
        `${duplicate.fileNames.join(", ")} — pick one and try again.`;
    }

    // Only a slot actually resupplied in this gesture clears its previous
    // error; an untouched slot's stale error (if any) is left alone.
    for (const kind of REQUIRED_FILE_KINDS) {
      const isDuplicateThisGesture = merged.duplicates.some(
        (duplicate) => duplicate.kind === kind,
      );
      if (!isDuplicateThisGesture && slots[kind] !== previousSlots[kind]) {
        delete slotErrors[kind];
      }
    }

    phase = "collecting";
    render();

    if (merged.duplicates.length === 0) {
      void tryAutoLoad();
    }
  }

  picker.addEventListener("change", () => {
    handleIncomingFiles(Array.from(picker.files ?? []));
    picker.value = "";
  });

  dropZone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dropZone.classList.add("file-input__dropzone--dragging");
  });
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("file-input__dropzone--dragging");
  });
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("file-input__dropzone--dragging");
    const dataTransfer = (event as DragEvent).dataTransfer;
    handleIncomingFiles(dataTransfer ? Array.from(dataTransfer.files) : []);
  });

  render();
}
