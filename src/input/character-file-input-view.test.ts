import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetWasmBridgeForTests } from "../wasm/bridge.ts";
import type { WasmBridgeOptions } from "../wasm/bridge.ts";
import { renderCharacterFileInput } from "./character-file-input-view.ts";
import { readFileAsBytes } from "./character-file-input.ts";
import type { CharacterFileInputOptions } from "./character-file-input.ts";

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

function validFileSet(): { def: File; air: File; sff: File; cns: File } {
  return {
    def: fileFromBytes(
      "ryu.def",
      textBytes("[Info]\nname = View Test Character\n"),
    ),
    air: fileFromBytes("ryu.air", fixtureBytes("sample.air")),
    sff: fileFromBytes("ryu.sff", fixtureBytes("v1-basic.sff")),
    cns: fileFromBytes("ryu.cns", fixtureBytes("sample.cns")),
  };
}

function pickFiles(picker: HTMLInputElement, files: File[]): void {
  Object.defineProperty(picker, "files", {
    value: files,
    configurable: true,
  });
  picker.dispatchEvent(new Event("change", { bubbles: true }));
}

function dropFiles(dropZone: HTMLElement, files: File[]): void {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files } });
  dropZone.dispatchEvent(event);
}

beforeEach(() => {
  resetWasmBridgeForTests();
});

describe("renderCharacterFileInput", () => {
  it("loads the character and reports success once all 4 files are picked via the file input", async () => {
    const root = document.createElement("div");
    const onLoaded = vi.fn();
    renderCharacterFileInput(root, { onLoaded, bridgeOptions: testOptions });

    const picker = root.querySelector<HTMLInputElement>(
      "#character-file-picker",
    );
    if (!picker) throw new Error("picker not found");
    const { def, air, sff, cns } = validFileSet();
    pickFiles(picker, [def, air, sff, cns]);

    await vi.waitFor(() => {
      expect(onLoaded).toHaveBeenCalledTimes(1);
    });

    const loadedCharacter = onLoaded.mock.calls[0]?.[0];
    expect(loadedCharacter.name).toBe("View Test Character");
    const loadedSffBytes = onLoaded.mock.calls[0]?.[1];
    expect(loadedSffBytes).toEqual(fixtureBytes("v1-basic.sff"));

    const status = root.querySelector(".file-input__status");
    expect(status?.textContent).toContain("Character loaded");
    expect(status?.textContent).toContain("ryu.def");
    expect(status?.textContent).toContain("ryu.sff");
  });

  it("accumulates files dropped across two separate gestures before loading", async () => {
    const root = document.createElement("div");
    const onLoaded = vi.fn();
    renderCharacterFileInput(root, { onLoaded, bridgeOptions: testOptions });
    const dropZone = root.querySelector<HTMLElement>(".file-input__dropzone");
    if (!dropZone) throw new Error("dropzone not found");
    const { def, air, sff, cns } = validFileSet();

    dropFiles(dropZone, [def, air]);
    expect(onLoaded).not.toHaveBeenCalled();

    dropFiles(dropZone, [sff, cns]);

    await vi.waitFor(() => {
      expect(onLoaded).toHaveBeenCalledTimes(1);
    });
  });

  it("shows which file is still missing and does not call onLoaded when only 3 of 4 are given", () => {
    const root = document.createElement("div");
    const onLoaded = vi.fn();
    renderCharacterFileInput(root, { onLoaded, bridgeOptions: testOptions });
    const picker = root.querySelector<HTMLInputElement>(
      "#character-file-picker",
    );
    if (!picker) throw new Error("picker not found");
    const { def, air, sff } = validFileSet();

    pickFiles(picker, [def, air, sff]);

    expect(onLoaded).not.toHaveBeenCalled();
    const cnsSlot = root.querySelector('[data-kind="cns"]');
    expect(cnsSlot?.textContent).toContain("Missing");
    const status = root.querySelector(".file-input__status");
    expect(status?.textContent).toBe("");
  });

  it("reports two files of the same kind dropped together as a conflict naming both, without auto-loading", () => {
    const root = document.createElement("div");
    const onLoaded = vi.fn();
    renderCharacterFileInput(root, { onLoaded, bridgeOptions: testOptions });
    const dropZone = root.querySelector<HTMLElement>(".file-input__dropzone");
    if (!dropZone) throw new Error("dropzone not found");
    const { air, sff, cns } = validFileSet();
    const defA = fileFromBytes("ryu-a.def", textBytes("a"));
    const defB = fileFromBytes("ryu-b.def", textBytes("b"));

    dropFiles(dropZone, [defA, defB, air, sff, cns]);

    expect(onLoaded).not.toHaveBeenCalled();
    const defSlot = root.querySelector('[data-kind="def"]');
    expect(defSlot?.textContent).toContain("ryu-a.def");
    expect(defSlot?.textContent).toContain("ryu-b.def");
    expect(defSlot?.textContent).toContain("Missing");
  });

  it("reports files with an unrecognized extension as ignored without blocking the other slots", () => {
    const root = document.createElement("div");
    const onLoaded = vi.fn();
    renderCharacterFileInput(root, { onLoaded, bridgeOptions: testOptions });
    const dropZone = root.querySelector<HTMLElement>(".file-input__dropzone");
    if (!dropZone) throw new Error("dropzone not found");
    const readme = fileFromBytes("readme.txt", textBytes("notes"));
    const { def } = validFileSet();

    dropFiles(dropZone, [readme, def]);

    const ignoredNotice = root.querySelector<HTMLElement>(
      ".file-input__ignored",
    );
    expect(ignoredNotice?.hidden).toBe(false);
    expect(ignoredNotice?.textContent).toContain("readme.txt");
    const defSlot = root.querySelector('[data-kind="def"]');
    expect(defSlot?.textContent).toContain("ryu.def");
  });

  it("shows a read-error on the offending slot and keeps the other 3 files when one file cannot be read", async () => {
    const root = document.createElement("div");
    const onLoaded = vi.fn();
    const failingOptions: CharacterFileInputOptions = {
      ...testOptions,
      readFileBytes: async (file) => {
        if (file.name === "ryu.sff") {
          throw new Error("simulated unreadable file");
        }
        return readFileAsBytes(file);
      },
    };
    renderCharacterFileInput(root, {
      onLoaded,
      bridgeOptions: failingOptions,
    });
    const picker = root.querySelector<HTMLInputElement>(
      "#character-file-picker",
    );
    if (!picker) throw new Error("picker not found");
    const { def, air, sff, cns } = validFileSet();

    pickFiles(picker, [def, air, sff, cns]);

    await vi.waitFor(() => {
      expect(root.querySelector('[data-kind="sff"]')?.textContent).toContain(
        "Missing",
      );
    });

    expect(onLoaded).not.toHaveBeenCalled();
    const sffSlot = root.querySelector('[data-kind="sff"]');
    expect(sffSlot?.textContent).toContain("simulated unreadable file");
    const defSlot = root.querySelector('[data-kind="def"]');
    expect(defSlot?.textContent).toContain("ryu.def");
  });

  it("shows a clear error instead of crashing when the file contents are malformed", async () => {
    const root = document.createElement("div");
    const onLoaded = vi.fn();
    renderCharacterFileInput(root, { onLoaded, bridgeOptions: testOptions });
    const picker = root.querySelector<HTMLInputElement>(
      "#character-file-picker",
    );
    if (!picker) throw new Error("picker not found");
    const { def, air, cns } = validFileSet();
    const garbageSff = fileFromBytes(
      "ryu.sff",
      textBytes("this is not a valid .sff file"),
    );

    expect(() => pickFiles(picker, [def, air, garbageSff, cns])).not.toThrow();

    const status = root.querySelector(".file-input__status");
    await vi.waitFor(() => {
      expect(status?.textContent).toContain("Could not load character");
    });

    expect(onLoaded).not.toHaveBeenCalled();
    expect(status?.textContent).toContain("sprite");
  });

  it("shows loading feedback while the character is being read and loaded", async () => {
    const root = document.createElement("div");
    const onLoaded = vi.fn();
    renderCharacterFileInput(root, { onLoaded, bridgeOptions: testOptions });
    const picker = root.querySelector<HTMLInputElement>(
      "#character-file-picker",
    );
    if (!picker) throw new Error("picker not found");
    const { def, air, sff, cns } = validFileSet();

    pickFiles(picker, [def, air, sff, cns]);

    const status = root.querySelector(".file-input__status");
    expect(status?.textContent).toBe("Loading character…");

    await vi.waitFor(() => {
      expect(status?.textContent).toContain("Character loaded");
    });
  });

  it("toggles a dragging state on drag-over feedback and clears it on drag-leave", () => {
    const root = document.createElement("div");
    renderCharacterFileInput(root, { onLoaded: vi.fn() });
    const dropZone = root.querySelector<HTMLElement>(".file-input__dropzone");
    if (!dropZone) throw new Error("dropzone not found");

    dropZone.dispatchEvent(
      new Event("dragenter", { bubbles: true, cancelable: true }),
    );
    expect(dropZone.classList.contains("file-input__dropzone--dragging")).toBe(
      true,
    );

    dropZone.dispatchEvent(
      new Event("dragleave", { bubbles: true, cancelable: true }),
    );
    expect(dropZone.classList.contains("file-input__dropzone--dragging")).toBe(
      false,
    );
  });

  it("exposes a keyboard-operable, labeled native file input naming the accepted file types", () => {
    const root = document.createElement("div");
    renderCharacterFileInput(root, { onLoaded: vi.fn() });

    const picker = root.querySelector<HTMLInputElement>(
      "#character-file-picker",
    );
    const label = root.querySelector<HTMLLabelElement>(".file-input__label");

    expect(picker?.type).toBe("file");
    expect(picker?.multiple).toBe(true);
    expect(picker?.accept).toBe(".def,.air,.sff,.cns");
    expect(label?.htmlFor).toBe("character-file-picker");
    expect(
      root.querySelector(".file-input__status")?.getAttribute("aria-live"),
    ).toBe("polite");
    expect(
      root.querySelector(".file-input__slots")?.getAttribute("aria-live"),
    ).toBe("polite");
  });

  it("replaces previous content instead of appending on repeated renders", () => {
    const root = document.createElement("div");

    renderCharacterFileInput(root, { onLoaded: vi.fn() });
    renderCharacterFileInput(root, { onLoaded: vi.fn() });

    expect(root.querySelectorAll("#character-file-picker")).toHaveLength(1);
  });
});
