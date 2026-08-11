import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  loadCharacter,
  resetWasmBridgeForTests,
  resolveSpritePixels,
} from "./bridge.ts";

// The real WASM assets (public/wasm/, gitignored) are fetched via
// `npm run wasm:download` before tests run in this environment. There is no
// running dev server under jsdom, so the fetch effects are injected as
// Node-backed stubs instead — see .vibe/decisions/002-wasm-bridge-loading-and-result-shape.md.
const publicWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
);
const testOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(publicWasmDir, "wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(publicWasmDir, "character.wasm"))),
};

const testdataDir = path.resolve(import.meta.dirname, "testdata");
function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(testdataDir, name)));
}

// Wrapped in `new Uint8Array(...)`: under Vitest's jsdom environment,
// TextEncoder is a Node-realm polyfill, so its output otherwise fails
// jsdom-realm `instanceof Uint8Array` checks (including the WASM module's
// own argument validation) despite being a genuine byte buffer.
function textBytes(text: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(text));
}

const defBytes = textBytes(
  "[Info]\nname = Bridge Test Character\nauthor = Someone\n",
);
const airBytes = fixture("sample.air");
const sffBytes = fixture("v1-basic.sff");
const cnsBytes = fixture("sample.cns");

beforeEach(() => {
  resetWasmBridgeForTests();
});

describe("loadCharacter", () => {
  it("loads and instantiates the WASM module and returns a typed character for valid input", async () => {
    const result = await loadCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      testOptions,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");

    expect(result.character.name).toBe("Bridge Test Character");
    expect(result.character.animations).toHaveLength(2);
    expect(result.character.sprites).toHaveLength(1);
    expect(result.character.stateDefs).toHaveLength(3);
  });

  it("maps every JSON field of a non-trivial animation to its typed shape", async () => {
    const result = await loadCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      testOptions,
    );
    if (!result.ok) throw new Error("expected ok result");

    const [walk, stance] = result.character.animations;
    expect(walk).toEqual({
      number: 200,
      loopStart: 3,
      frames: [
        {
          group: 0,
          image: 0,
          x: 0,
          y: 0,
          time: 5,
          flip: "",
          blend: "",
          clsn1: [],
          clsn2: [{ left: -6, top: -92, right: 6, bottom: 0 }],
        },
        {
          group: 0,
          image: 1,
          x: 5,
          y: -2,
          time: 4,
          flip: "H",
          blend: "",
          clsn1: [],
          clsn2: [{ left: -6, top: -92, right: 6, bottom: 0 }],
        },
        {
          group: 0,
          image: 2,
          x: 0,
          y: 0,
          time: 3,
          flip: "",
          blend: "A",
          clsn1: [{ left: -3, top: -73, right: 15, bottom: -1 }],
          clsn2: [{ left: -6, top: -92, right: 6, bottom: 0 }],
        },
        {
          group: 0,
          image: 3,
          x: 0,
          y: 0,
          time: 6,
          flip: "",
          blend: "",
          clsn1: [],
          clsn2: [{ left: -6, top: -92, right: 6, bottom: 0 }],
        },
      ],
    });
    expect(stance).toEqual({
      number: 201,
      loopStart: 0,
      frames: [
        {
          group: 0,
          image: 0,
          x: 0,
          y: 0,
          time: 10,
          flip: "HV",
          blend: "AS",
          clsn1: [],
          clsn2: [],
        },
      ],
    });
  });

  it("maps sprite groups and state defs (including controllers) to their typed shape", async () => {
    const result = await loadCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      testOptions,
    );
    if (!result.ok) throw new Error("expected ok result");

    expect(result.character.sprites[0]).toEqual({
      index: 0,
      sprites: [
        {
          group: 0,
          image: 0,
          width: 57,
          height: 103,
          axisX: 25,
          axisY: 99,
          palette: 0,
        },
      ],
    });

    const [standing] = result.character.stateDefs;
    expect(standing.number).toBe(0);
    expect(standing.type).toBe("S");
    expect(standing.moveType).toBe("I");
    expect(standing.physics).toBe("S");
    expect(standing.ctrl).toBe(true);
    expect(standing.controllers).toEqual([
      {
        type: "ChangeState",
        triggers: ['Command = "holdback"', "StateType = S"],
        parameters: { ctrl: "0", value: "10" },
      },
      { type: "VelSet", triggers: [], parameters: { x: "0", y: "0" } },
    ]);
  });

  it("returns a typed error instead of throwing when the sprite bytes are malformed", async () => {
    const garbageSffBytes = textBytes("this is not a valid .sff file");

    const result = await loadCharacter(
      defBytes,
      airBytes,
      garbageSffBytes,
      cnsBytes,
      testOptions,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error).toContain("sprite");
  });

  it("returns a typed error instead of throwing when every buffer is empty", async () => {
    const empty = new Uint8Array(0);

    const result = await loadCharacter(empty, empty, empty, empty, testOptions);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(typeof result.error).toBe("string");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("still returns a correct result after a prior call reported an error", async () => {
    const garbageSffBytes = textBytes("garbage");
    const errorResult = await loadCharacter(
      defBytes,
      airBytes,
      garbageSffBytes,
      cnsBytes,
      testOptions,
    );
    expect(errorResult.ok).toBe(false);

    const okResult = await loadCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      testOptions,
    );

    expect(okResult.ok).toBe(true);
    if (!okResult.ok) throw new Error("expected ok result");
    expect(okResult.character.name).toBe("Bridge Test Character");
  });

  it("reuses the same WASM instantiation across repeated calls instead of re-fetching", async () => {
    let wasmExecFetchCount = 0;
    let wasmBytesFetchCount = 0;
    const countingOptions = {
      fetchWasmExecSource: async () => {
        wasmExecFetchCount++;
        return testOptions.fetchWasmExecSource();
      },
      fetchWasmBytes: async () => {
        wasmBytesFetchCount++;
        return testOptions.fetchWasmBytes();
      },
    };

    await loadCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      countingOptions,
    );
    await loadCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      countingOptions,
    );

    expect(wasmExecFetchCount).toBe(1);
    expect(wasmBytesFetchCount).toBe(1);
  });
});

describe("resolveSpritePixels", () => {
  it("decodes a real sprite's pixels at its correct dimensions", async () => {
    const [result] = await resolveSpritePixels(
      sffBytes,
      [[0, 0]],
      null,
      testOptions,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.width).toBe(57);
    expect(result.height).toBe(103);
    expect(result.pixels).toBeInstanceOf(Uint8Array);
    expect(result.pixels.length).toBe(57 * 103 * 4);
  });

  it("returns one typed result per request, in the same order", async () => {
    const results = await resolveSpritePixels(
      sffBytes,
      [
        [0, 0],
        [999, 999],
      ],
      null,
      testOptions,
    );

    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
  });

  it("returns a distinguishable error for a sprite that doesn't exist, instead of throwing", async () => {
    const [result] = await resolveSpritePixels(
      sffBytes,
      [[999, 999]],
      null,
      testOptions,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error).toContain("sprite not found");
  });

  it("returns a typed error instead of throwing for malformed sffBytes", async () => {
    const garbageSffBytes = textBytes("this is not a valid .sff file");

    const [result] = await resolveSpritePixels(
      garbageSffBytes,
      [[0, 0]],
      null,
      testOptions,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("still returns a correct result after a prior call reported an error", async () => {
    const garbageSffBytes = textBytes("garbage");
    const [errorResult] = await resolveSpritePixels(
      garbageSffBytes,
      [[0, 0]],
      null,
      testOptions,
    );
    expect(errorResult.ok).toBe(false);

    const [okResult] = await resolveSpritePixels(
      sffBytes,
      [[0, 0]],
      null,
      testOptions,
    );
    expect(okResult.ok).toBe(true);
  });
});
