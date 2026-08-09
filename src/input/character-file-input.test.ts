import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { resetWasmBridgeForTests } from "../wasm/bridge.ts";
import type { WasmBridgeOptions } from "../wasm/bridge.ts";
import {
  type CharacterFileInputOptions,
  type CompleteFileSlots,
  type FileSlots,
  isComplete,
  loadCharacterFromSlots,
  mergeFiles,
  missingKinds,
  readFileAsBytes,
} from "./character-file-input.ts";

// Real WASM assets (public/wasm/, gitignored) fetched via `npm run
// wasm:download` before tests run — injected as Node-backed stubs since
// there is no running dev server under jsdom. Mirrors
// src/wasm/bridge.test.ts's own setup.
const publicWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
);
const testOptions: WasmBridgeOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(publicWasmDir, "wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(publicWasmDir, "character.wasm"))),
};

const testdataDir = path.resolve(import.meta.dirname, "..", "wasm", "testdata");
function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(testdataDir, name)));
}

function textBytes(text: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(text));
}

function fileFromBytes(name: string, bytes: Uint8Array): File {
  return new File([bytes as BufferSource], name);
}

beforeEach(() => {
  resetWasmBridgeForTests();
});

describe("mergeFiles", () => {
  it("classifies files by extension case-insensitively and fills empty slots", () => {
    const def = fileFromBytes("Ryu.DEF", textBytes("def"));
    const air = fileFromBytes("ryu.Air", textBytes("air"));
    const sff = fileFromBytes("ryu.sff", textBytes("sff"));
    const cns = fileFromBytes("ryu.cns", textBytes("cns"));

    const result = mergeFiles({}, [def, air, sff, cns]);

    expect(result.slots).toEqual({ def, air, sff, cns });
    expect(result.ignored).toEqual([]);
    expect(result.duplicates).toEqual([]);
  });

  it("accumulates across multiple merge calls without losing previously filled slots", () => {
    const def = fileFromBytes("ryu.def", textBytes("def"));
    const air = fileFromBytes("ryu.air", textBytes("air"));
    const sff = fileFromBytes("ryu.sff", textBytes("sff"));
    const cns = fileFromBytes("ryu.cns", textBytes("cns"));

    const first = mergeFiles({}, [def, air]);
    const second = mergeFiles(first.slots, [sff, cns]);

    expect(second.slots).toEqual({ def, air, sff, cns });
  });

  it("replaces a slot's file when a new file of the same kind is merged in a later call", () => {
    const badSff = fileFromBytes("ryu.sff", textBytes("garbage"));
    const goodSff = fileFromBytes("ryu-fixed.sff", textBytes("real sff bytes"));

    const first = mergeFiles({}, [badSff]);
    const second = mergeFiles(first.slots, [goodSff]);

    expect(second.slots.sff).toBe(goodSff);
  });

  it("reports files with an unrecognized extension as ignored instead of assigning them", () => {
    const readme = fileFromBytes("readme.txt", textBytes("notes"));
    const def = fileFromBytes("ryu.def", textBytes("def"));

    const result = mergeFiles({}, [readme, def]);

    expect(result.ignored).toEqual([readme]);
    expect(result.slots).toEqual({ def });
  });

  it("reports two files of the same required kind given in one call as a duplicate, naming both filenames, and leaves that slot untouched", () => {
    const defA = fileFromBytes("ryu-a.def", textBytes("a"));
    const defB = fileFromBytes("ryu-b.def", textBytes("b"));
    const existingSff = fileFromBytes("ryu.sff", textBytes("sff"));

    const result = mergeFiles({ sff: existingSff }, [defA, defB]);

    expect(result.duplicates).toEqual([
      { kind: "def", fileNames: ["ryu-a.def", "ryu-b.def"] },
    ]);
    expect(result.slots).toEqual({ sff: existingSff });
  });
});

describe("missingKinds", () => {
  it("lists all four required kinds as missing for empty slots", () => {
    expect(missingKinds({})).toEqual(["def", "air", "sff", "cns"]);
  });

  it("lists only the kinds not yet present", () => {
    const slots: FileSlots = {
      def: fileFromBytes("ryu.def", textBytes("def")),
      sff: fileFromBytes("ryu.sff", textBytes("sff")),
    };

    expect(missingKinds(slots)).toEqual(["air", "cns"]);
  });

  it("returns an empty array once all four required kinds are present", () => {
    const slots: FileSlots = {
      def: fileFromBytes("ryu.def", textBytes("def")),
      air: fileFromBytes("ryu.air", textBytes("air")),
      sff: fileFromBytes("ryu.sff", textBytes("sff")),
      cns: fileFromBytes("ryu.cns", textBytes("cns")),
    };

    expect(missingKinds(slots)).toEqual([]);
  });
});

describe("isComplete", () => {
  it("is false when at least one required kind is missing", () => {
    expect(
      isComplete({ def: fileFromBytes("ryu.def", textBytes("def")) }),
    ).toBe(false);
  });

  it("is true once all four required kinds are present", () => {
    const slots: FileSlots = {
      def: fileFromBytes("ryu.def", textBytes("def")),
      air: fileFromBytes("ryu.air", textBytes("air")),
      sff: fileFromBytes("ryu.sff", textBytes("sff")),
      cns: fileFromBytes("ryu.cns", textBytes("cns")),
    };

    expect(isComplete(slots)).toBe(true);
  });
});

describe("loadCharacterFromSlots", () => {
  function validSlots(): CompleteFileSlots {
    return {
      def: fileFromBytes(
        "ryu.def",
        textBytes("[Info]\nname = File Input Test Character\n"),
      ),
      air: fileFromBytes("ryu.air", fixtureBytes("sample.air")),
      sff: fileFromBytes("ryu.sff", fixtureBytes("v1-basic.sff")),
      cns: fileFromBytes("ryu.cns", fixtureBytes("sample.cns")),
    };
  }

  it("reads all four files and loads the character via the WASM bridge", async () => {
    const result = await loadCharacterFromSlots(validSlots(), testOptions);

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.character.name).toBe("File Input Test Character");
    expect(result.character.animations).toHaveLength(2);
  });

  it("returns a read-error naming the offending file when one file cannot be read as bytes", async () => {
    const slots = validSlots();
    const optionsWithFailingSff: CharacterFileInputOptions = {
      ...testOptions,
      readFileBytes: async (file) => {
        if (file.name === "ryu.sff") {
          throw new Error("simulated unreadable file");
        }
        return readFileAsBytes(file);
      },
    };

    const result = await loadCharacterFromSlots(slots, optionsWithFailingSff);

    expect(result.status).toBe("read-error");
    if (result.status !== "read-error") throw new Error("expected read-error");
    expect(result.error.kind).toBe("sff");
    expect(result.error.fileName).toBe("ryu.sff");
    expect(result.error.message).toContain("simulated unreadable file");
  });

  it("returns a bridge-error with the module's message when the file contents are malformed", async () => {
    const slots = validSlots();
    slots.sff = fileFromBytes(
      "ryu.sff",
      textBytes("this is not a valid .sff file"),
    );

    const result = await loadCharacterFromSlots(slots, testOptions);

    expect(result.status).toBe("bridge-error");
    if (result.status !== "bridge-error")
      throw new Error("expected bridge-error");
    expect(result.message).toContain("sprite");
  });
});
