// Tests for the reusable beginner-mode info-icon + tooltip-bubble widget
// (backlog item 022). See .vibe/decisions/022-beginner-mode-tooltip-widget-and-placement.md
// for why positioning is computed via a pure function rather than asserted
// against real layout (jsdom does not implement layout at all).
import { afterEach, describe, expect, it } from "vitest";
import { computeTooltipPosition, createInfoTooltip } from "./info-tooltip.ts";
import { resetPreferencesForTests, setBeginnerMode } from "./preferences.ts";

describe("computeTooltipPosition", () => {
  const viewport = { width: 800, height: 600 };
  const bubbleSize = { width: 200, height: 40 };

  it("places the bubble below and left-aligned to the trigger when it fits", () => {
    const triggerRect = { top: 100, left: 50, width: 16, height: 16 };
    const position = computeTooltipPosition(triggerRect, bubbleSize, viewport);
    expect(position).toEqual({ top: 100 + 16 + 4, left: 50 });
  });

  it("clamps left so the bubble never overflows the right edge of the viewport", () => {
    const triggerRect = { top: 100, left: 750, width: 16, height: 16 };
    const position = computeTooltipPosition(triggerRect, bubbleSize, viewport);
    expect(position.left).toBe(viewport.width - bubbleSize.width);
  });

  it("flips above the trigger when it would overflow the bottom edge", () => {
    const triggerRect = { top: 590, left: 50, width: 16, height: 16 };
    const position = computeTooltipPosition(triggerRect, bubbleSize, viewport);
    expect(position.top).toBe(590 - bubbleSize.height - 4);
  });

  it("never returns a negative coordinate, even in a degenerate viewport smaller than the bubble", () => {
    const triggerRect = { top: 5, left: 5, width: 16, height: 16 };
    const position = computeTooltipPosition(triggerRect, bubbleSize, {
      width: 50,
      height: 30,
    });
    expect(position.top).toBeGreaterThanOrEqual(0);
    expect(position.left).toBeGreaterThanOrEqual(0);
  });
});

describe("createInfoTooltip", () => {
  afterEach(() => {
    resetPreferencesForTests();
  });

  it("is hidden when beginner mode is off", () => {
    const tooltip = createInfoTooltip("Explanation text", "What is X?");
    expect(tooltip.element.hidden).toBe(true);
  });

  it("is visible when beginner mode is already on at creation time", () => {
    setBeginnerMode(true);
    const tooltip = createInfoTooltip("Explanation text", "What is X?");
    expect(tooltip.element.hidden).toBe(false);
  });

  it("becomes visible the moment beginner mode is turned on", () => {
    const tooltip = createInfoTooltip("Explanation text", "What is X?");
    expect(tooltip.element.hidden).toBe(true);
    setBeginnerMode(true);
    expect(tooltip.element.hidden).toBe(false);
  });

  it("becomes hidden again the moment beginner mode is turned off, along with an open bubble", () => {
    setBeginnerMode(true);
    const tooltip = createInfoTooltip("Explanation text", "What is X?");
    const trigger = tooltip.element.querySelector<HTMLButtonElement>("button");
    trigger?.dispatchEvent(new FocusEvent("focus"));
    const bubble = tooltip.element.querySelector('[role="tooltip"]');
    expect(bubble?.classList.contains("info-tooltip__bubble--visible")).toBe(
      true,
    );

    setBeginnerMode(false);
    expect(tooltip.element.hidden).toBe(true);
  });

  it("wires the trigger's aria-describedby to the bubble carrying the explanation text", () => {
    const tooltip = createInfoTooltip(
      "Sprites sharing a group.",
      "What is a group?",
    );
    const trigger = tooltip.element.querySelector<HTMLButtonElement>("button");
    const bubbleId = trigger?.getAttribute("aria-describedby");
    expect(bubbleId).toBeTruthy();
    const bubble = tooltip.element.querySelector(`#${bubbleId}`);
    expect(bubble?.textContent).toBe("Sprites sharing a group.");
    expect(bubble?.getAttribute("role")).toBe("tooltip");
  });

  it("gives the trigger its own accessible label, distinct from the tooltip text", () => {
    const tooltip = createInfoTooltip("Explanation.", "What is a group?");
    const trigger = tooltip.element.querySelector<HTMLButtonElement>("button");
    expect(trigger?.getAttribute("aria-label")).toBe("What is a group?");
  });

  it("reveals the bubble on focus and hides it on blur", () => {
    const tooltip = createInfoTooltip("Explanation.", "What is X?");
    const trigger = tooltip.element.querySelector<HTMLButtonElement>("button");
    const bubble = tooltip.element.querySelector('[role="tooltip"]');

    trigger?.dispatchEvent(new FocusEvent("focus"));
    expect(bubble?.classList.contains("info-tooltip__bubble--visible")).toBe(
      true,
    );
    trigger?.dispatchEvent(new FocusEvent("blur"));
    expect(bubble?.classList.contains("info-tooltip__bubble--visible")).toBe(
      false,
    );
  });

  it("reveals the bubble on mouseenter and hides it on mouseleave", () => {
    const tooltip = createInfoTooltip("Explanation.", "What is X?");
    const trigger = tooltip.element.querySelector<HTMLButtonElement>("button");
    const bubble = tooltip.element.querySelector('[role="tooltip"]');

    trigger?.dispatchEvent(new MouseEvent("mouseenter"));
    expect(bubble?.classList.contains("info-tooltip__bubble--visible")).toBe(
      true,
    );
    trigger?.dispatchEvent(new MouseEvent("mouseleave"));
    expect(bubble?.classList.contains("info-tooltip__bubble--visible")).toBe(
      false,
    );
  });

  it("also reveals the bubble on click, so a touch tap (no hover) can open it", () => {
    const tooltip = createInfoTooltip("Explanation.", "What is X?");
    const trigger = tooltip.element.querySelector<HTMLButtonElement>("button");
    const bubble = tooltip.element.querySelector('[role="tooltip"]');

    trigger?.dispatchEvent(new MouseEvent("click"));
    expect(bubble?.classList.contains("info-tooltip__bubble--visible")).toBe(
      true,
    );
  });

  it("dismisses the bubble on Escape without moving focus away from the trigger", () => {
    const tooltip = createInfoTooltip("Explanation.", "What is X?");
    const trigger = tooltip.element.querySelector<HTMLButtonElement>("button");
    const bubble = tooltip.element.querySelector('[role="tooltip"]');

    trigger?.dispatchEvent(new FocusEvent("focus"));
    trigger?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(bubble?.classList.contains("info-tooltip__bubble--visible")).toBe(
      false,
    );
  });

  it("stops reacting to beginner-mode changes once destroyed", () => {
    const tooltip = createInfoTooltip("Explanation.", "What is X?");
    tooltip.destroy();
    setBeginnerMode(true);
    expect(tooltip.element.hidden).toBe(true);
  });

  it("retranslates the trigger's label and the bubble's text via setText", () => {
    const tooltip = createInfoTooltip("Explication.", "Qu'est-ce que X ?");
    tooltip.setText("Explanation.", "What is X?");

    const trigger = tooltip.element.querySelector<HTMLButtonElement>("button");
    expect(trigger?.getAttribute("aria-label")).toBe("What is X?");
    expect(tooltip.element.querySelector('[role="tooltip"]')?.textContent).toBe(
      "Explanation.",
    );
  });
});
