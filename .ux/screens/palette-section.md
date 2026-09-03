---
slug: palette-section
title: Palette section
flow: 001
status: designed
source: [file(s) implementing it — filled by /ux:implement]
---

# Palette section

## Purpose

See which `.act` palette files a character references, and preview an uploaded override applied across every sprite/frame.

## Layout

Unchanged content from `palette-picker.ts` (referenced-files list → upload control → status → reset), hosted as the workspace's main-slot content. Fits within the section's available height without its own internal scroll under normal data volumes (a character rarely references more than a handful of `.act` files); if a future character references an unusually long list, it gets the same capped-height `overflow-y: auto` treatment as the Statedef/sprite lists rather than growing past the frame. Beginner-mode info icon next to "Palette override" explaining `.act`/palette-bank vocabulary.

## States

| State | Trigger | What the user sees | Primary action |
|---|---|---|---|
| No references | Character references no `.act` files | Existing "references no palette files" message | Still able to upload an override |
| Referenced (metadata only) | Character references one or more `.act` files | File names listed (existing behavior — bytes are never available, only names) | Upload an override to actually preview one |
| Override active | User uploads a valid `.act` | Status shows the override is applied; sprite/animation sections reflect it live | Reset to the character's own palette |
| Invalid upload | Wrong-sized or malformed `.act` | Existing inline error, no crash | Retry with a different file |
| Reset after character switch | `load-character-popup` succeeds | Referenced-files list re-renders for the new character; any active override is cleared, not silently reapplied to the new sprites (states expert requirement) | Continue browsing |

## Interactions

| Element | Action | Result | Feedback (<100 ms) |
|---|---|---|---|
| (all existing controls) | unchanged | unchanged | unchanged |
| Beginner-mode info icon (new) | Hover / focus | Tooltip explains `.act`/palette override | Tooltip appears |

## Content

| Key | Text | Notes |
|---|---|---|
| (all existing content keys) | unchanged | see `src/viewer/palette-picker.ts` |
| tooltip.palette-override | "An external color table (.act file) you upload, applied to every sprite in place of the character's own colors." | beginner mode only |

## Accessibility

- **Keyboard order:** unchanged from current implementation, already keyboard-operable.
- **Focus after each action:** switching into this section moves focus to its heading; uploading a file keeps focus on the upload control, consistent with today.
- **Announcements:** existing status-line announcements unchanged; a character switch that clears an active override should say so explicitly ("Palette override cleared for the new character") so the change isn't silently invisible.
- **Contrast & targets:** unchanged, already AA.
- **Motion:** none.
