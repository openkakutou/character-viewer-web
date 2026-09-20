// Pure, DOM-free logic for a folder-based character load (backlog item
// 015): given the files gathered from a folder selection/drop (see
// ./folder-entries.ts), finds the character's `.def` entry point, learns
// which sibling files it actually references (via
// ./def-files-section.ts's minimal `[Files]`-section read), resolves each
// referenced filename against the folder listing by basename, then feeds
// the resolved bytes to the `character` WASM bridge. Replaces item 003's
// per-kind file accumulation outright — see
// .vibe/decisions/017-folder-only-input-def-files-parse-and-ported-resolution.md
// for why a local `.def` parse is unavoidable here (the `character` WASM
// module's `load` call needs all four required files' bytes at once, so
// there is no WASM call that could answer "what does this .def reference"
// on its own) and why the candidate-detection/referenced-file-resolution
// rules are ported from the sibling `*-editor`/`*-viewer-web` apps' own
// already-shipped folder input.
import { loadCharacter } from "../wasm/bridge.ts";
import type { WasmBridgeOptions } from "../wasm/bridge.ts";
import type { CharacterData } from "../wasm/types.ts";
import { parseDefFileReferences } from "./def-files-section.ts";
import type { GatheredFile } from "./folder-entries.ts";

/** The 4 file kinds the WASM `load` call itself requires to produce a character. */
export type RequiredFileKind = "def" | "air" | "sff" | "cns";

/** Stable display order for the 4 required kinds. */
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

/** The 3 always-required, `.def`-referenced kinds (everything but `.def` itself). */
type ReferencedKind = "air" | "sff" | "cns";

function isDefFile(gathered: GatheredFile): boolean {
  return gathered.file.name.toLowerCase().endsWith(".def");
}

export type DefCandidateResolution =
  | { status: "no-files" }
  | { status: "no-candidate" }
  | { status: "success"; entry: GatheredFile }
  | { status: "needs-selection"; candidates: GatheredFile[] };

/**
 * Decides what to do with the files gathered from a folder selection: none
 * gathered at all, none ending in `.def`, exactly one match (auto-load), or
 * several (the caller must ask the user which one is the character).
 */
export function resolveDefCandidates(
  files: readonly GatheredFile[],
): DefCandidateResolution {
  if (files.length === 0) {
    return { status: "no-files" };
  }
  const candidates = files.filter(isDefFile);
  if (candidates.length === 0) {
    return { status: "no-candidate" };
  }
  if (candidates.length === 1) {
    return { status: "success", entry: candidates[0] };
  }
  return { status: "needs-selection", candidates };
}

/** The last path segment of a `.def`-referenced path, forward- or backslash-separated. */
function referencedBasename(referencedPath: string): string {
  const normalized = referencedPath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1];
}

export type ReferenceResolution =
  | { status: "no-reference" }
  | { status: "success"; entry: GatheredFile }
  | { status: "not-found"; referencedName: string }
  | { status: "ambiguous"; referencedName: string; candidates: GatheredFile[] };

/**
 * Resolves a `.def`-referenced filename against the already-gathered folder
 * listing, by basename — exact match first, case-insensitive fallback
 * second (mirroring the sibling `*-editor`/`*-viewer-web` apps' own
 * established resolution rule). More than one match at either level is
 * reported as ambiguous rather than silently picking one.
 */
export function resolveReferencedFile(
  referencedPath: string,
  files: readonly GatheredFile[],
): ReferenceResolution {
  if (referencedPath.trim() === "") {
    return { status: "no-reference" };
  }

  const targetBasename = referencedBasename(referencedPath);

  const exact = files.filter((f) => f.file.name === targetBasename);
  if (exact.length === 1) return { status: "success", entry: exact[0] };
  if (exact.length > 1) {
    return {
      status: "ambiguous",
      referencedName: referencedPath,
      candidates: exact,
    };
  }

  const targetLower = targetBasename.toLowerCase();
  const caseInsensitive = files.filter(
    (f) => f.file.name.toLowerCase() === targetLower,
  );
  if (caseInsensitive.length === 1) {
    return { status: "success", entry: caseInsensitive[0] };
  }
  if (caseInsensitive.length > 1) {
    return {
      status: "ambiguous",
      referencedName: referencedPath,
      candidates: caseInsensitive,
    };
  }

  return { status: "not-found", referencedName: referencedPath };
}

/** A specific file's bytes could not be read (e.g. an unreadable/corrupt selection). */
export interface FileReadError {
  kind: RequiredFileKind;
  fileName: string;
  message: string;
}

/**
 * Outcome of reading the resolved files and passing them to the WASM
 * bridge. `sffBytes` on success is the same raw `.sff` bytes already read,
 * threaded through (not re-read) so a caller can later decode a specific
 * sprite's actual pixels on demand via `resolveSpritePixels` —
 * `character`'s metadata-only bytes never carry that. See
 * .vibe/decisions/006-sff-bytes-threaded-through-load-result-for-on-demand-pixel-decode.md.
 */
export type CharacterInputResult =
  | { status: "success"; character: CharacterData; sffBytes: Uint8Array }
  | { status: "read-error"; error: FileReadError }
  | { status: "bridge-error"; message: string };

/**
 * Every outcome a folder-based load can produce: `CharacterInputResult`'s
 * own 3 (once a single `.def` is settled and its references are all
 * resolved) plus the folder/candidate/reference-resolution stages that can
 * end the attempt earlier.
 */
export type CharacterFolderLoadResult =
  | CharacterInputResult
  | { status: "no-files" }
  | { status: "no-candidate" }
  | { status: "needs-selection"; candidates: GatheredFile[] }
  | {
      status: "reference-not-found";
      kind: ReferencedKind;
      referencedName: string;
    }
  | {
      status: "reference-ambiguous";
      kind: ReferencedKind;
      referencedName: string;
      candidates: GatheredFile[];
    };

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

async function readKindBytes(
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

type RequiredReferenceResult =
  | { ok: true; entry: GatheredFile }
  | {
      ok: false;
      result: Extract<
        CharacterFolderLoadResult,
        { status: "reference-not-found" | "reference-ambiguous" }
      >;
    };

/**
 * Resolves one required referenced kind (`air`/`sff`/`cns`), folding an
 * empty/absent reference into the same "not found" outcome as one that was
 * named but couldn't be located — either way there is nothing usable to
 * load.
 */
function resolveRequiredReference(
  kind: ReferencedKind,
  referencedPath: string,
  files: readonly GatheredFile[],
): RequiredReferenceResult {
  const resolution = resolveReferencedFile(referencedPath, files);
  if (resolution.status === "success") {
    return { ok: true, entry: resolution.entry };
  }
  if (resolution.status === "ambiguous") {
    return {
      ok: false,
      result: {
        status: "reference-ambiguous",
        kind,
        referencedName: resolution.referencedName,
        candidates: resolution.candidates,
      },
    };
  }
  const referencedName =
    resolution.status === "not-found" ? resolution.referencedName : "";
  return {
    ok: false,
    result: { status: "reference-not-found", kind, referencedName },
  };
}

/**
 * Reads and parses a single already-chosen `.def` candidate: learns which
 * sibling files it references, resolves each against `files` (the same
 * folder listing the candidate itself came from), reads their bytes, and
 * loads the character through the WASM bridge.
 */
export async function loadCharacterFromChosenDef(
  entry: GatheredFile,
  files: readonly GatheredFile[],
  options: CharacterFileInputOptions = {},
): Promise<CharacterFolderLoadResult> {
  const readFileBytes = options.readFileBytes ?? readFileAsBytes;

  const defAttempt = await readKindBytes("def", entry.file, readFileBytes);
  if (!defAttempt.ok) return { status: "read-error", error: defAttempt.error };
  const defBytes = defAttempt.bytes;

  const references = parseDefFileReferences(new TextDecoder().decode(defBytes));

  const airResolved = resolveRequiredReference(
    "air",
    references.animationFile,
    files,
  );
  if (!airResolved.ok) return airResolved.result;
  const sffResolved = resolveRequiredReference(
    "sff",
    references.spriteFile,
    files,
  );
  if (!sffResolved.ok) return sffResolved.result;
  const cnsResolved = resolveRequiredReference(
    "cns",
    references.constantsFile,
    files,
  );
  if (!cnsResolved.ok) return cnsResolved.result;

  const toRead: { kind: RequiredFileKind; entry: GatheredFile }[] = [
    { kind: "air", entry: airResolved.entry },
    { kind: "sff", entry: sffResolved.entry },
    { kind: "cns", entry: cnsResolved.entry },
  ];

  const bytesByKind = { def: defBytes } as Record<RequiredFileKind, Uint8Array>;
  for (const { kind, entry: fileEntry } of toRead) {
    const attempt = await readKindBytes(kind, fileEntry.file, readFileBytes);
    if (!attempt.ok) return { status: "read-error", error: attempt.error };
    bytesByKind[kind] = attempt.bytes;
  }

  const result = await loadCharacter(
    bytesByKind.def,
    bytesByKind.air,
    bytesByKind.sff,
    bytesByKind.cns,
    options,
  );
  if (!result.ok) return { status: "bridge-error", message: result.error };

  return {
    status: "success",
    character: result.character,
    sffBytes: bytesByKind.sff,
  };
}

/**
 * Resolves which candidate `.def` to use among the files gathered from a
 * folder selection, then — only once a single candidate is settled — reads,
 * parses, and resolves its referenced files. `no-files`/`no-candidate`/
 * `needs-selection` short-circuit without reading anything.
 */
export async function loadCharacterFromFolderFiles(
  files: readonly GatheredFile[],
  options: CharacterFileInputOptions = {},
): Promise<CharacterFolderLoadResult> {
  const resolution = resolveDefCandidates(files);
  if (resolution.status !== "success") {
    return resolution;
  }
  return loadCharacterFromChosenDef(resolution.entry, files, options);
}
