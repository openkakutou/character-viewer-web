---
slug: load-character-popup
title: Load character popup
flow: 001
status: designed
source: [file(s) implementing it — filled by /ux:implement]
---

# Load character popup

## Purpose

Load a different character mid-session, without losing the one currently loaded until the new one actually works.

## Layout

A modal dialog (native `<dialog>` via `showModal()`, or the eventual `web-ui-kit` dialog primitive once built — tracked as a backlog item, not implemented in this task) opened from the toolbar's "Load character…" button, over the still-visible (dimmed, inert) workspace. Contains exactly the same 4-slot file widget as `launch-screen`, starting empty every time it opens — never pre-filled with the current character's file names, since those bytes aren't retained for re-display.

## States

| State | Trigger | What the user sees | Primary action |
|---|---|---|---|
| Empty | Popup just opened | Drop zone + 4 "Missing" slots, identical widget to `launch-screen` | Drop or pick files |
| Partial | Some slots filled | Same per-slot behavior as `launch-screen` | Continue |
| Loading | All 4 filled, decoding | Loading status | Wait |
| Error | A slot fails validation | That slot's specific error; the workspace underneath (old character) is completely unaffected | Retry that slot |
| Success | All 4 valid | Popup closes; workspace updates per `workspace-shell`'s "Loading a different character" state | (automatic) |

## Interactions

| Element | Action | Result | Feedback (<100 ms) |
|---|---|---|---|
| Drop zone / picker | Same as `launch-screen` | Same as `launch-screen` | Same as `launch-screen` |
| Close control / Esc / backdrop click | Dismiss | Popup closes, discarding any in-progress slots; the current character is untouched | Popup closes, focus returns to the "Load character…" toolbar button |

## Content

| Key | Text | Notes |
|---|---|---|
| title | "Load a different character" | distinguishes intent from the first-run launch screen even though the widget is identical |
| (file-slot content) | same as `launch-screen` | reused verbatim |

## Accessibility

- **Keyboard order:** on open, focus moves to the first focusable control inside (the picker button); Tab/Shift+Tab cycles only within the popup while open (focus trap); Esc closes it.
- **Focus after each action:** on close (any path — success, cancel, Esc, backdrop), focus returns exactly to the toolbar's "Load character…" button that opened it.
- **Announcements:** `role="dialog"`, `aria-modal="true"`, labelled by its own heading via `aria-labelledby`; the rest of the app is `aria-hidden`/inert while open, per the accessibility consultation's baseline contract for any popup this app builds.
- **Contrast & targets:** must meet the same AA baseline as every other control; the backdrop needs enough contrast against the dimmed workspace to be visually distinct without obscuring that the workspace is still there (signals "your current character is safe").
- **Motion:** open/close is instant or a simple fade — no kit motion tokens exist yet.
