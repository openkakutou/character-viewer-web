---
slug: sprite-browser-section
title: Sprite browser section
flow: 001
status: designed
source: [file(s) implementing it — filled by /ux:implement]
---

# Sprite browser section

## Purpose

Browse every sprite in the character's sheet, group by group, with an on-demand decoded preview.

## Layout

Unchanged content from `sprite-browser.ts` (collapsible group list + preview stage), hosted as the workspace's main-slot content. The group/sprite list keeps its existing capped-height `overflow-y: auto`; the preview stage keeps its fixed height — together they already fit within a bounded frame without page scroll, so this section needs no new scroll handling, only a new container.

## States

| State | Trigger | What the user sees | Primary action |
|---|---|---|---|
| Success | Character loaded, section selected | Group list (collapsed by default), no sprite selected yet | Expand a group, select a sprite |
| Sprite selected | User picks a sprite | Decoded preview in the canvas, scaled to fit | Pick a different sprite |
| Decoding | Between selection and decode completing | Existing status text; stale selections are discarded via the existing token guard | Wait, or select again (superseding it) |
| Re-entered after another section | User returns via sidebar | The same group stays expanded, the same sprite stays selected — content was hidden, not destroyed, while away | Continue browsing |
| Reset after character switch | `load-character-popup` succeeds | Group list collapses back to default; no sprite selected — an old index has no meaning against new data (states expert requirement) | Browse the new sheet |

## Interactions

| Element | Action | Result | Feedback (<100 ms) |
|---|---|---|---|
| (all existing controls) | unchanged | unchanged | unchanged |

## Content

| Key | Text | Notes |
|---|---|---|
| (all existing content keys) | unchanged | see `src/viewer/sprite-browser.ts` |
| tooltip.group | "Sprites sharing the same group index in the .sff sheet." | beginner mode only, on the group toggle |

## Accessibility

- **Keyboard order:** unchanged from current implementation, already keyboard-operable.
- **Focus after each action:** switching into this section moves focus to its heading; selecting a sprite keeps focus on the sprite control, consistent with today.
- **Announcements:** unchanged.
- **Contrast & targets:** unchanged, already AA.
- **Motion:** none.
