// Tests for the launch screen (backlog item 020): the full-frame,
// first-character-load step shown before any workspace exists. Reuses the
// existing character file input widget as-is — see
// .ux/screens/launch-screen.md.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetWasmBridgeForTests } from "../wasm/bridge.ts";
import type { WasmBridgeOptions } from "../wasm/bridge.ts";
import { renderLaunchScreen } from "./launch-screen.ts";

describe("renderLaunchScreen", () => {
  it("renders the character file input full-frame, with no toolbar or app-shell chrome", () => {
    const root = document.createElement("div");

    renderLaunchScreen(root, { onLoaded: vi.fn() });

    expect(root.querySelector(".launch-screen")).not.toBeNull();
    expect(
      root.querySelector<HTMLInputElement>("#character-file-picker"),
    ).not.toBeNull();
    expect(root.querySelector("wuik-app-shell")).toBeNull();
    expect(root.querySelector("wuik-toolbar")).toBeNull();
  });

  it("replaces previous content instead of appending on repeated renders", () => {
    const root = document.createElement("div");

    renderLaunchScreen(root, { onLoaded: vi.fn() });
    renderLaunchScreen(root, { onLoaded: vi.fn() });

    expect(root.querySelectorAll(".launch-screen")).toHaveLength(1);
    expect(root.querySelectorAll('input[type="file"]')).toHaveLength(1);
  });

  it("does not call onLoaded before all 4 files are provided", () => {
    const root = document.createElement("div");
    const onLoaded = vi.fn();

    renderLaunchScreen(root, { onLoaded });

    expect(onLoaded).not.toHaveBeenCalled();
  });
});

describe("renderLaunchScreen — end-to-end character load", () => {
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

  beforeEach(() => {
    resetWasmBridgeForTests();
  });

  it("calls onLoaded with the loaded character and sffBytes once the 4 real files validate", async () => {
    const root = document.createElement("div");
    const onLoaded = vi.fn();
    renderLaunchScreen(root, { onLoaded, bridgeOptions: testOptions });

    const picker = root.querySelector<HTMLInputElement>(
      "#character-file-picker",
    );
    if (!picker) throw new Error("picker not found");

    const testdataDir = path.resolve(
      import.meta.dirname,
      "..",
      "wasm",
      "testdata",
    );
    const fixture = (name: string) =>
      new Uint8Array(readFileSync(path.join(testdataDir, name)));
    const textBytes = (text: string) =>
      new Uint8Array(new TextEncoder().encode(text));

    const def = new File(
      [textBytes("[Info]\nname = Launch Screen Character\n") as BufferSource],
      "ryu.def",
    );
    const air = new File([fixture("sample.air") as BufferSource], "ryu.air");
    const sff = new File([fixture("v1-basic.sff") as BufferSource], "ryu.sff");
    const cns = new File([fixture("sample.cns") as BufferSource], "ryu.cns");

    Object.defineProperty(picker, "files", {
      value: [def, air, sff, cns],
      configurable: true,
    });
    picker.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));

    const [character, sffBytes] = onLoaded.mock.calls[0];
    expect(character.name).toBe("Launch Screen Character");
    expect(sffBytes).toBeInstanceOf(Uint8Array);
  });
});
