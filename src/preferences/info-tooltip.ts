// The reusable beginner-mode info-icon + tooltip-bubble widget (backlog
// item 022): a small "i" button that, only while beginner mode
// (preferences.ts) is on, sits next to a MUGEN/Ikemen technical term and
// reveals a short plain-language explanation on hover, keyboard focus, or a
// touch tap (no hover on touch devices, so click doubles as the reveal
// there too) -- dismissible with Escape without losing focus. The trigger's
// `aria-describedby` always points at the bubble regardless of its visual
// reveal state, so a screen reader announces the explanation as soon as the
// icon receives focus, not only once some separate "hover" gesture has
// happened. See .vibe/decisions/022-beginner-mode-tooltip-widget-and-placement.md.
import { isBeginnerMode, onBeginnerModeChange } from "./preferences.ts";

const VISIBLE_CLASS = "info-tooltip__bubble--visible";
const GAP_PX = 4;

let idCounter = 0;

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Pure placement math for the tooltip bubble, factored out of the DOM
 * wiring below so it stays unit-testable despite depending on real layout
 * measurements (`getBoundingClientRect`/`window.inner*`) that only exist in
 * a real browser -- jsdom returns an all-zero rect for every element, so
 * this can only be verified for real via the `run` skill. Prefers below and
 * left-aligned to the trigger; clamps horizontally so the bubble never
 * overflows the viewport's right edge, and flips above the trigger instead
 * of overflowing the bottom edge. Never returns a negative coordinate, even
 * in a degenerate viewport smaller than the bubble itself.
 */
export function computeTooltipPosition(
  triggerRect: Rect,
  bubbleSize: Size,
  viewport: Size,
  gap = GAP_PX,
): { top: number; left: number } {
  let left = triggerRect.left;
  if (left + bubbleSize.width > viewport.width) {
    left = viewport.width - bubbleSize.width;
  }
  left = Math.max(0, left);

  let top = triggerRect.top + triggerRect.height + gap;
  if (top + bubbleSize.height > viewport.height) {
    top = triggerRect.top - bubbleSize.height - gap;
  }
  top = Math.max(0, top);

  return { top, left };
}

export interface InfoTooltipHandle {
  /** The wrapper to insert next to the term it explains -- `hidden` unless beginner mode is on. */
  element: HTMLElement;
  /** Retranslates the trigger's accessible label and the bubble's explanation text in place (a locale change). */
  setText(text: string, accessibleLabel: string): void;
  /** Unsubscribes from beginner-mode changes. Call before discarding `element` (a fresh render/character switch). */
  destroy(): void;
}

/**
 * Creates one info-icon + tooltip-bubble pair. `text` is the plain-language
 * explanation shown in the bubble; `accessibleLabel` is the trigger
 * button's own accessible name (e.g. "What is a Statedef?") -- distinct
 * from the explanation itself, so a screen reader announces a real label
 * before reading the description via `aria-describedby`.
 */
export function createInfoTooltip(
  text: string,
  accessibleLabel: string,
): InfoTooltipHandle {
  const wrapper = document.createElement("span");
  wrapper.className = "info-tooltip";
  wrapper.hidden = !isBeginnerMode();

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "info-tooltip__trigger";

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 16 16");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML =
    '<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"></circle>' +
    '<circle cx="8" cy="4.5" r="1" fill="currentColor"></circle>' +
    '<line x1="8" y1="7" x2="8" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>';
  trigger.appendChild(icon);

  const bubble = document.createElement("span");
  bubble.className = "info-tooltip__bubble";
  bubble.id = `info-tooltip-${idCounter++}`;
  bubble.setAttribute("role", "tooltip");
  bubble.textContent = text;

  trigger.setAttribute("aria-describedby", bubble.id);
  trigger.setAttribute("aria-label", accessibleLabel);

  function show(): void {
    const triggerRect = trigger.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const { top, left } = computeTooltipPosition(triggerRect, bubbleRect, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;
    bubble.classList.add(VISIBLE_CLASS);
  }

  function hide(): void {
    bubble.classList.remove(VISIBLE_CLASS);
  }

  trigger.addEventListener("mouseenter", show);
  trigger.addEventListener("mouseleave", () => {
    if (document.activeElement !== trigger) hide();
  });
  trigger.addEventListener("focus", show);
  trigger.addEventListener("blur", hide);
  // Doubles as the reveal gesture on touch devices, which have no hover.
  trigger.addEventListener("click", show);
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });

  wrapper.append(trigger, bubble);

  const unsubscribe = onBeginnerModeChange(() => {
    wrapper.hidden = !isBeginnerMode();
    if (wrapper.hidden) hide();
  });

  return {
    element: wrapper,
    setText(nextText, nextAccessibleLabel) {
      bubble.textContent = nextText;
      trigger.setAttribute("aria-label", nextAccessibleLabel);
    },
    destroy: unsubscribe,
  };
}
