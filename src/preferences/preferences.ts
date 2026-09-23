// This app's own session-scoped preferences (backlog item 022): currently
// just "beginner mode" (off by default), a single flag every section's own
// info-tooltip icons (see info-tooltip.ts) subscribe to. Deliberately a
// plain in-memory module singleton, not persisted to `localStorage` — the
// acceptance criteria only asks that the setting survive the rest of the
// session (including a character switch, item 021), not a page reload, and
// this mirrors how every other piece of this app's state (the loaded
// character itself) already resets on reload. See
// .vibe/decisions/022-beginner-mode-tooltip-widget-and-placement.md.

let beginnerMode = false;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Whether beginner-mode explanatory tooltips are currently turned on. */
export function isBeginnerMode(): boolean {
  return beginnerMode;
}

/**
 * Sets beginner mode on/off, notifying every subscriber immediately -- but
 * only when the value actually changes, so setting it to what it already
 * was is a silent no-op rather than an extra notification round.
 */
export function setBeginnerMode(value: boolean): void {
  if (value === beginnerMode) return;
  beginnerMode = value;
  for (const listener of listeners) listener();
}

/**
 * Subscribes to every future beginner-mode change. Returns an unsubscribe
 * function -- every info-tooltip icon (recreated on each section
 * re-render) calls this on mount and its returned unsubscribe on its own
 * teardown, the same "subscribe on render, unsubscribe before the next one"
 * shape `onLocaleChange` callers already use throughout this app.
 */
export function onBeginnerModeChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset: clears the flag and every subscriber, so one test file's
 * state can never leak into the next. Mirrors `resetWasmBridgeForTests`. */
export function resetPreferencesForTests(): void {
  beginnerMode = false;
  listeners.clear();
}
