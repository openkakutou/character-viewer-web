// Pure, DOM-free logic for gathering a character's 4 required files
// (`.def`/`.air`/`.sff`/`.cns`) across any number of picker/drop gestures
// and feeding the completed set to the `character` WASM bridge. See
// .vibe/decisions/004-character-file-input-interaction-model.md for the
// accumulating-slots interaction model and its rationale.
import { loadCharacter } from "../wasm/bridge.ts";
import type { WasmBridgeOptions } from "../wasm/bridge.ts";
import type { CharacterData } from "../wasm/types.ts";

/** One of the 4 file kinds required to load a character. */
export type RequiredFileKind = "def" | "air" | "sff" | "cns";

/** Stable display/processing order for the 4 required kinds. */
export const REQUIRED_FILE_KINDS: readonly RequiredFileKind[] = [
  "def",
  "air",
  "sff",
  "cns",
];

/** The filename extension (including the dot) matched for each required kind. */
export const EXTENSION_BY_KIND: Readonly<Record<RequiredFileKind, string>> = {
  def: ".def",
  air: ".air",
  sff: ".sff",
  cns: ".cns",
};

/** Files gathered so far, one optional slot per required kind. */
export type FileSlots = Partial<Record<RequiredFileKind, File>>;

/** `FileSlots` once every required kind has been filled. */
export type CompleteFileSlots = Record<RequiredFileKind, File>;

/** Two or more files of the same required kind given in a single `mergeFiles` call. */
export interface DuplicateKindError {
  kind: RequiredFileKind;
  fileNames: string[];
}

export interface MergeFilesResult {
  /** Updated slots: unrecognized files are dropped, duplicate kinds leave their slot untouched. */
  slots: FileSlots;
  /** Files that matched none of the 4 required extensions. */
  ignored: File[];
  /** Kinds for which this call supplied more than one file at once. */
  duplicates: DuplicateKindError[];
}

function classify(file: File): RequiredFileKind | null {
  const lowerName = file.name.toLowerCase();
  return (
    REQUIRED_FILE_KINDS.find((kind) =>
      lowerName.endsWith(EXTENSION_BY_KIND[kind]),
    ) ?? null
  );
}

/**
 * Merges newly picked/dropped files into the existing slots.
 *
 * - A file matching a required extension for a kind with no file yet, or a
 *   single file for a kind already filled, fills/replaces that slot — this
 *   is how a user corrects a single bad file without redoing the others.
 * - Two or more files matching the *same* kind within this one call are
 *   reported as a duplicate instead of silently picking one; that slot is
 *   left as it was.
 * - Files matching none of the 4 required extensions are reported as ignored.
 */
export function mergeFiles(
  current: FileSlots,
  incoming: File[],
): MergeFilesResult {
  const byKind = new Map<RequiredFileKind, File[]>();
  const ignored: File[] = [];

  for (const file of incoming) {
    const kind = classify(file);
    if (kind === null) {
      ignored.push(file);
      continue;
    }
    const list = byKind.get(kind);
    if (list) {
      list.push(file);
    } else {
      byKind.set(kind, [file]);
    }
  }

  const duplicates: DuplicateKindError[] = [];
  const slots: FileSlots = { ...current };

  for (const [kind, files] of byKind) {
    if (files.length > 1) {
      duplicates.push({ kind, fileNames: files.map((file) => file.name) });
      continue;
    }
    slots[kind] = files[0];
  }

  return { slots, ignored, duplicates };
}

/** Required kinds not yet present in `slots`, in display order. */
export function missingKinds(slots: FileSlots): RequiredFileKind[] {
  return REQUIRED_FILE_KINDS.filter((kind) => slots[kind] === undefined);
}

/** True once every required kind has a file, narrowing `slots` to `CompleteFileSlots`. */
export function isComplete(slots: FileSlots): slots is CompleteFileSlots {
  return missingKinds(slots).length === 0;
}

/** A specific file's bytes could not be read (e.g. an unreadable/corrupt selection). */
export interface FileReadError {
  kind: RequiredFileKind;
  fileName: string;
  message: string;
}

/** Outcome of reading the 4 required files and passing them to the WASM bridge. */
export type CharacterInputResult =
  | { status: "success"; character: CharacterData }
  | { status: "read-error"; error: FileReadError }
  | { status: "bridge-error"; message: string };

/**
 * Reads a File's bytes via `FileReader` rather than `Blob#arrayBuffer()` —
 * unlike `arrayBuffer()` (unimplemented in jsdom as of this writing),
 * `FileReader` behaves identically in a real browser and under jsdom/Node,
 * the same jsdom-compatibility concern `src/wasm/bridge.ts` documents for
 * loading `wasm_exec.js`.
 */
export function readFileAsBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(new Uint8Array(result));
      } else {
        reject(new Error("FileReader did not return an ArrayBuffer"));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("failed to read file"));
    };
    reader.readAsArrayBuffer(file);
  });
}

export interface CharacterFileInputOptions extends WasmBridgeOptions {
  /** Reads a File's bytes. Defaults to `readFileAsBytes`; injectable for testing failure paths. */
  readFileBytes?: (file: File) => Promise<Uint8Array>;
}

async function readSlotBytes(
  kind: RequiredFileKind,
  file: File,
  readFileBytes: (file: File) => Promise<Uint8Array>,
): Promise<
  { ok: true; bytes: Uint8Array } | { ok: false; error: FileReadError }
> {
  try {
    const bytes = await readFileBytes(file);
    return { ok: true, bytes };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind,
        fileName: file.name,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Reads the 4 required files as byte buffers and loads the character
 * through the WASM bridge. `slots` must already be complete — callers
 * check `isComplete` first, since there is nothing meaningful to attempt
 * otherwise.
 */
export async function loadCharacterFromSlots(
  slots: CompleteFileSlots,
  options: CharacterFileInputOptions = {},
): Promise<CharacterInputResult> {
  const readFileBytes = options.readFileBytes ?? readFileAsBytes;
  const bytesByKind = {} as Record<RequiredFileKind, Uint8Array>;

  for (const kind of REQUIRED_FILE_KINDS) {
    const attempt = await readSlotBytes(kind, slots[kind], readFileBytes);
    if (!attempt.ok) {
      return { status: "read-error", error: attempt.error };
    }
    bytesByKind[kind] = attempt.bytes;
  }

  const result = await loadCharacter(
    bytesByKind.def,
    bytesByKind.air,
    bytesByKind.sff,
    bytesByKind.cns,
    options,
  );

  if (!result.ok) {
    return { status: "bridge-error", message: result.error };
  }
  return { status: "success", character: result.character };
}
