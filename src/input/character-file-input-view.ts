// DOM component for backlog item 015 (folder selection as the sole
// character file input): a native `<input webkitdirectory>` folder picker
// plus a drag-and-drop zone accepting a dropped folder, replacing item
// 003's 4-slot per-kind file picker/drop zone outright — see this backlog
// item's own Notes for why folder selection is the only way to reach
// sibling files in a browser. Every interactive control is a real native
// element (folder input, radio inputs inside a `<fieldset>`, buttons)
// rather than a custom `role="button"` div, so keyboard operability comes
// for free from the browser. Structure/state-machine shape (Phase, the
// multi-candidate radio-group picker, the "Choose a different folder"
// reset control) is ported from the sibling `*-editor`/`*-viewer-web`
// apps' own already-shipped folder input — see
// .vibe/decisions/017-folder-only-input-def-files-parse-and-ported-resolution.md.
import type { CharacterData } from "../wasm/types.ts";
import {
  type CharacterFileInputOptions,
  type CharacterFolderLoadResult,
  EXTENSION_BY_KIND,
  loadCharacterFromChosenDef,
  loadCharacterFromFolderFiles,
} from "./character-file-input.ts";
import type { GatheredFile } from "./folder-entries.ts";
import {
  type DataTransferItemLike,
  filesFromDataTransferItems,
  filesFromWebkitDirectoryFiles,
} from "./folder-entries.ts";

export interface CharacterFileInputViewOptions {
  /**
   * Called once the 4 required files have been resolved, read, and the
   * character successfully loaded. `sffBytes` is the same raw `.sff` bytes
   * just read, threaded through for a caller that needs to decode a
   * specific sprite's pixels later (`resolveSpritePixels`) — `character`'s
   * own metadata never carries pixel data.
   */
  onLoaded: (character: CharacterData, sffBytes: Uint8Array) => void;
  /** Forwarded to the file-reading/WASM bridge layer; injectable for testing. */
  bridgeOptions?: CharacterFileInputOptions;
}

type Phase = "idle" | "loading" | "needs-selection" | "done";

type ErrorResult = Exclude<
  CharacterFolderLoadResult,
  { status: "success" | "needs-selection" }
>;

function formatErrorMessage(result: ErrorResult): string {
  switch (result.status) {
    case "no-files":
      return "Couldn't read anything from the selected folder — your browser may not support folder selection here.";
    case "no-candidate":
      return "No .def file found in this folder — expected one like kfm.def.";
    case "read-error":
      return `Could not read ${result.error.fileName}: ${result.error.message}`;
    case "bridge-error":
      return `Could not load character: ${result.message}`;
    case "reference-not-found":
      return result.referencedName === ""
        ? `The selected .def doesn't reference a ${EXTENSION_BY_KIND[result.kind]} file at all.`
        : `The selected .def references "${result.referencedName}" for its ${EXTENSION_BY_KIND[result.kind]} file, but that file wasn't found anywhere in the selected folder.`;
    case "reference-ambiguous":
      return `The selected .def references "${result.referencedName}" for its ${EXTENSION_BY_KIND[result.kind]} file, but ${result.candidates.length} files in the folder share that name — could not tell which one to use.`;
  }
}

/**
 * Renders the folder-based character input into `root`, replacing its
 * previous content.
 */
export function renderCharacterFileInput(
  root: HTMLElement,
  options: CharacterFileInputViewOptions,
): void {
  root.replaceChildren();

  let phase: Phase = "idle";
  let statusText = "";
  let isError = false;
  let selectedIndex: number | null = null;
  let lastGatheredFiles: GatheredFile[] = [];

  const panel = document.createElement("wuik-panel");
  panel.className = "file-input";

  const dropZone = document.createElement("div");
  dropZone.className = "file-input__dropzone";

  const label = document.createElement("label");
  label.className = "file-input__label";
  label.htmlFor = "character-folder-picker";
  label.textContent =
    "Select a character folder (containing its .def file, e.g. kfm.def)";

  const picker = document.createElement("input");
  picker.type = "file";
  picker.id = "character-folder-picker";
  picker.setAttribute("webkitdirectory", "");
  picker.multiple = true;

  const hint = document.createElement("p");
  hint.className = "file-input__hint";
  hint.textContent = "…or drag and drop a character folder here";

  dropZone.append(label, picker, hint);

  const selectionContainer = document.createElement("div");
  selectionContainer.className = "file-input__selection";
  selectionContainer.hidden = true;

  const status = document.createElement("div");
  status.className = "file-input__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "file-input__reset";
  resetButton.dataset.action = "reset";
  resetButton.textContent = "Choose a different folder";
  resetButton.hidden = true;

  panel.append(dropZone, selectionContainer, status, resetButton);
  root.appendChild(panel);

  function render(): void {
    picker.disabled = phase === "loading";
    dropZone.classList.toggle(
      "file-input__dropzone--loading",
      phase === "loading",
    );
    status.classList.toggle("file-input__status--error", isError);
    status.textContent = statusText;
    resetButton.hidden = phase === "idle" || phase === "loading";
    selectionContainer.hidden = phase !== "needs-selection";
  }

  function resetToIdle(): void {
    phase = "idle";
    statusText = "";
    isError = false;
    selectedIndex = null;
    picker.value = "";
    selectionContainer.replaceChildren();
    render();
    picker.focus();
  }

  function renderSelection(candidates: GatheredFile[]): void {
    selectionContainer.replaceChildren();
    selectedIndex = null;

    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "Which file is the character?";
    fieldset.appendChild(legend);

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.dataset.action = "confirm-selection";
    confirmButton.textContent = "Load selected file";
    confirmButton.disabled = true;

    candidates.forEach((candidate, index) => {
      const optionLabel = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "character-def-candidate";
      input.value = String(index);
      // A jsdom quirk: `.click()` on a radio reliably toggles `.checked`
      // but doesn't reliably synthesize a "change" event under this
      // project's pinned jsdom — read the selection from "click" instead.
      // Real browsers also fire "click" for keyboard (arrow-key roving)
      // selection within a native radio group, so this stays fully
      // keyboard-operable.
      input.addEventListener("click", () => {
        selectedIndex = index;
        confirmButton.disabled = false;
      });
      optionLabel.append(
        input,
        document.createTextNode(` ${candidate.relativePath}`),
      );
      fieldset.appendChild(optionLabel);
    });

    confirmButton.addEventListener("click", () => {
      if (selectedIndex === null) return;
      const chosen = candidates[selectedIndex];
      phase = "loading";
      statusText = `Reading ${chosen.file.name}…`;
      isError = false;
      render();
      void finishLoading(
        loadCharacterFromChosenDef(
          chosen,
          lastGatheredFiles,
          options.bridgeOptions,
        ),
      );
    });

    selectionContainer.append(fieldset, confirmButton);
  }

  async function finishLoading(
    resultPromise: Promise<CharacterFolderLoadResult>,
  ): Promise<void> {
    const result = await resultPromise;

    if (result.status === "success") {
      phase = "done";
      isError = false;
      statusText = `Character loaded: ${result.character.name}`;
      render();
      options.onLoaded(result.character, result.sffBytes);
      return;
    }

    if (result.status === "needs-selection") {
      phase = "needs-selection";
      isError = false;
      statusText = `Found ${result.candidates.length} .def files in the selected folder — pick which one is the character.`;
      renderSelection(result.candidates);
      render();
      return;
    }

    phase = "done";
    isError = true;
    statusText = formatErrorMessage(result);
    render();
  }

  function handleGathered(files: GatheredFile[]): void {
    lastGatheredFiles = files;
    phase = "loading";
    isError = false;
    statusText = "Reading the selected folder…";
    render();
    void finishLoading(
      loadCharacterFromFolderFiles(files, options.bridgeOptions),
    );
  }

  picker.addEventListener("change", () => {
    handleGathered(
      filesFromWebkitDirectoryFiles(Array.from(picker.files ?? [])),
    );
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
    const dataTransfer = (event as DragEvent).dataTransfer as unknown as {
      items: readonly DataTransferItemLike[];
    } | null;
    const items = dataTransfer ? Array.from(dataTransfer.items) : [];
    void filesFromDataTransferItems(items).then((files) =>
      handleGathered(files),
    );
  });

  resetButton.addEventListener("click", () => {
    resetToIdle();
  });

  render();
}
