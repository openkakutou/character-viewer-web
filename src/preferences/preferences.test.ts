// Tests for the app's own session-scoped preferences state (backlog item
// 022): a "beginner mode" flag, off by default, that must persist for the
// rest of the session (not just the current section) and notify every
// subscriber immediately when it changes.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isBeginnerMode,
  onBeginnerModeChange,
  resetPreferencesForTests,
  setBeginnerMode,
} from "./preferences.ts";

describe("preferences", () => {
  afterEach(() => {
    resetPreferencesForTests();
  });

  it("defaults beginner mode to off", () => {
    expect(isBeginnerMode()).toBe(false);
  });

  it("reflects the value passed to setBeginnerMode", () => {
    setBeginnerMode(true);
    expect(isBeginnerMode()).toBe(true);
    setBeginnerMode(false);
    expect(isBeginnerMode()).toBe(false);
  });

  it("notifies a subscriber when the value actually changes", () => {
    const callback = vi.fn();
    onBeginnerModeChange(callback);
    setBeginnerMode(true);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not notify a subscriber when set to the value it already had", () => {
    const callback = vi.fn();
    setBeginnerMode(true);
    onBeginnerModeChange(callback);
    setBeginnerMode(true); // no-op: already true
    expect(callback).not.toHaveBeenCalled();
  });

  it("stops notifying a subscriber after it unsubscribes", () => {
    const callback = vi.fn();
    const unsubscribe = onBeginnerModeChange(callback);
    unsubscribe();
    setBeginnerMode(true);
    expect(callback).not.toHaveBeenCalled();
  });

  it("supports more than one independent subscriber", () => {
    const first = vi.fn();
    const second = vi.fn();
    onBeginnerModeChange(first);
    onBeginnerModeChange(second);
    setBeginnerMode(true);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
