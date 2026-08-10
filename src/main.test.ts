import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "./main.ts";
import { resetWasmBridgeForTests } from "./wasm/bridge.ts";
import type { WasmBridgeOptions } from "./wasm/bridge.ts";

describe("renderApp", () => {
  it("mounts a wuik-app-shell root frame with a toolbar title (including the version) and the character file input in the main content area", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");

    const shell = root.querySelector("wuik-app-shell");
    expect(shell).not.toBeNull();

    const toolbar = shell?.querySelector('[slot="toolbar"]');
    expect(toolbar?.tagName.toLowerCase()).toBe("wuik-toolbar");
    expect(toolbar?.getAttribute("role")).toBe("banner");
    expect(toolbar?.textContent).toBe("Character Viewer — v0.1.0");

    const main = shell?.querySelector("main");
    expect(main?.querySelector('input[type="file"]')).not.toBeNull();
  });

  it("does not slot anything into the sidebar region", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");

    expect(root.querySelector('[slot="sidebar"]')).toBeNull();
  });

  it("replaces previous content instead of appending on repeated renders", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");
    renderApp(root, "0.2.0");

    expect(root.querySelectorAll("wuik-app-shell")).toHaveLength(1);
    expect(root.querySelector('[slot="toolbar"]')?.textContent).toBe(
      "Character Viewer — v0.2.0",
    );
    expect(root.querySelectorAll('input[type="file"]')).toHaveLength(1);
  });

  it("renders without throwing and keeps a valid structure when given an empty version string", () => {
    const root = document.createElement("div");

    expect(() => renderApp(root, "")).not.toThrow();
    expect(root.querySelector('[slot="toolbar"]')?.textContent).toBe(
      "Character Viewer — v",
    );
  });

  it("does not show the characteristics panel before any character is loaded", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");

    expect(root.querySelector(".characteristics-panel")).toBeNull();
  });
});

describe("renderApp — end-to-end character load", () => {
  const publicWasmDir = path.resolve(
    import.meta.dirname,
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

  it("shows the characteristics panel with the loaded character's data once a real character finishes loading", async () => {
    const root = document.createElement("div");
    renderApp(root, "0.1.0", { bridgeOptions: testOptions });

    const picker = root.querySelector<HTMLInputElement>(
      "#character-file-picker",
    );
    if (!picker) throw new Error("picker not found");

    const testdataDir = path.resolve(import.meta.dirname, "wasm", "testdata");
    const fixture = (name: string) =>
      new Uint8Array(readFileSync(path.join(testdataDir, name)));
    const textBytes = (text: string) =>
      new Uint8Array(new TextEncoder().encode(text));

    const def = new File(
      [textBytes("[Info]\nname = End To End Character\n") as BufferSource],
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

    await vi.waitFor(() => {
      expect(root.querySelector(".characteristics-panel")).not.toBeNull();
    });

    expect(root.textContent).toContain("End To End Character");
    const animCount = root.querySelector(
      ".characteristics-panel__stat--animations dd",
    );
    expect(animCount?.textContent).toBe("2");
    // sample.cns declares Statedefs 0, -1, and 200 — sorted ascending.
    const stateItems = Array.from(
      root.querySelectorAll(".characteristics-panel__states-list li"),
    ).map((el) => el.textContent);
    expect(stateItems).toEqual(["-1", "0", "200"]);
  });
});
