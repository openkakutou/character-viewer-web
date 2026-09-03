---
slug: launch-screen
title: Launch screen
flow: 001
status: designed
source: [file(s) implementing it — filled by /ux:implement]
---

# Launch screen

## Purpose

Load the first character of the session: gather the 4 required files, in any order and any number of drops, before anything else in the app is reachable.

## Layout

Full-frame, centered, replacing the entire viewport (no toolbar/sidebar chrome yet — there is nothing to navigate to before a character loads). Reuses the existing character file input widget (`src/input/character-file-input-view.ts`) as-is: a `<wuik-panel>`-wrapped drop zone with a picker fallback, above the 4-slot status list. No page-level scroll at ≥1024px; if the viewport is short enough that the widget doesn't fit, the widget's own container scrolls internally, never the page.

## States

| State | Trigger | What the user sees | Primary action |
|---|---|---|---|
| Empty | First paint, no files yet | Drop zone + "Select the 4 character files" hint; all 4 slots show "Missing" | Drop or pick files |
| Partial | 1–3 of the 4 files provided (any combination, across any number of drops) | Filled slots show their file name; remaining slots still "Missing"; an ignored/unexpected file shows the existing warning notice | Continue dropping/picking |
| Loading | All 4 slots filled, WASM bridge decoding | Status line shows a loading message; slots stay as filled | Wait |
| Error | A slot's file is missing/conflicting/unreadable/corrupt, or the bridge itself fails | That slot shows its specific error text (existing per-slot error UI); other valid slots are unaffected | Replace only the failing file |
| Success | All 4 files valid and the character loads | Brief "Character loaded: `<name>`" confirmation, then the app transitions to `workspace-shell` on `characteristics-section` | (automatic transition) |

## Interactions

| Element | Action | Result | Feedback (<100 ms) |
|---|---|---|---|
| Drop zone | Drag files over it | Zone shows the existing `--dragging` visual state | Border/background change on dragenter |
| Drop zone | Drop files | Files matched against the 4 required kinds; matched ones fill their slot | Per-slot status updates |
| "Choose Files" picker | Select files | Same matching as drop | Per-slot status updates |
| (automatic) | All 4 slots valid | Character loads via WASM bridge | Loading status, then success confirmation and transition |

## Content

| Key | Text | Notes |
|---|---|---|
| title | "Select the 4 character files (.def, .air, .sff, .cns)" | unchanged from current implementation |
| hint | "…or drag and drop them here" | unchanged |
| slot.missing | "Missing" | unchanged |
| slot.error | (existing per-error-kind text: missing/conflicting/unreadable/corrupt) | unchanged |
| success | "Character loaded: {name}" | unchanged; now also triggers the transition to the workspace, which it didn't before |

## Accessibility

- **Keyboard order:** picker button → (as slots become interactive, none are focusable themselves — status only) — unchanged from today's implementation, already keyboard-operable per `web-ui-kit`'s baseline.
- **Focus after each action:** unaffected by a drop/pick (focus stays where it was); on success, focus moves to the workspace's main heading (`characteristics-section`'s title) once the transition completes, not left on a picker control that no longer exists on screen.
- **Announcements (live regions / screen reader):** the existing status line (`aria-live`-equivalent per current implementation) continues to announce slot fills and errors; add an announcement for the transition itself ("Character loaded, showing Characteristics") so a screen-reader user isn't left wondering why the screen changed.
- **Contrast & targets:** unchanged — already meets `web-ui-kit`'s AA baseline.
- **Motion:** the transition to the workspace should be a simple cross-fade or instant swap, never a scripted animation the user can't skip — no motion tokens exist in the kit yet (inventory known gap), so keep this transition CSS-free (instant) until one does.
