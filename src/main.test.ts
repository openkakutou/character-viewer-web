import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "./main.ts";
import { resetWasmBridgeForTests } from "./wasm/bridge.ts";
import type { WasmBridgeOptions } from "./wasm/bridge.ts";

describe("renderApp", () => {
  it("shows the launch screen (the character file input, full-frame) before any character is loaded", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");

    expect(root.querySelector(".launch-screen")).not.toBeNull();
    expect(root.querySelector('input[type="file"]')).not.toBeNull();
  });

  it("does not show any workspace-shell chrome before a character is loaded", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");

    expect(root.querySelector("wuik-app-shell")).toBeNull();
    expect(root.querySelector("wuik-tabs")).toBeNull();
  });

  it("does not show the characteristics panel, sprite browser, or animation player before any character is loaded", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");

    expect(root.querySelector(".characteristics-panel")).toBeNull();
    expect(root.querySelector(".sprite-browser")).toBeNull();
    expect(root.querySelector(".animation-player")).toBeNull();
  });

  it("renders without throwing for an empty version string", () => {
    const root = document.createElement("div");

    expect(() => renderApp(root, "")).not.toThrow();
    expect(root.querySelector(".launch-screen")).not.toBeNull();
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

  it("transitions from the launch screen to the workspace shell, landing on Characteristics, once a real character finishes loading", async () => {
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

    // The launch screen is gone; the workspace shell (toolbar + sidebar)
    // has replaced it entirely.
    expect(root.querySelector(".launch-screen")).toBeNull();
    expect(root.querySelector("wuik-app-shell")).not.toBeNull();
    expect(root.querySelector('[slot="toolbar"]')?.textContent).toContain(
      "v0.1.0",
    );
    expect(root.querySelector('[slot="toolbar"]')?.textContent).toContain(
      "End To End Character",
    );

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

    // v1-basic.sff carries exactly one sprite group with one sprite —
    // mounted (though hidden behind Characteristics) as soon as the
    // workspace shell exists.
    expect(root.querySelector(".sprite-browser")).not.toBeNull();
    expect(root.querySelector(".sprite-browser h3")?.textContent).toBe(
      "Sprites (1)",
    );

    // sample.air declares 2 animations; the player defaults to the first.
    expect(root.querySelector(".animation-player")).not.toBeNull();
    await vi.waitFor(() => {
      expect(
        root.querySelector(".animation-player__frame-counter")?.textContent,
      ).toMatch(/^Frame 1 \/ \d+$/);
    });
  });
});
