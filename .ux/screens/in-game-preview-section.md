---
slug: in-game-preview-section
title: In-game preview section (coming soon)
flow: 001
status: designed
source: [file(s) implementing it — filled by /ux:implement]
---

# In-game preview section (coming soon)

## Purpose

Give the "in-game preview" mode described in the README's planned scope a real, reachable entry point in the workspace now, even though the mode itself (trigger animations/special moves live) isn't built yet — so the app's full intended shape is visible rather than hidden.

## Layout

Simple centered message within the main slot, same frame as every other section (no page scroll). No new components needed beyond what `<wuik-panel>` already provides.

## States

| State | Trigger | What the user sees | Primary action |
|---|---|---|---|
| Coming soon (only state) | User selects "In-game preview" in the sidebar | A short explanation of what this mode will do (trigger animations live, one-click special moves) and that it isn't built yet | Switch to another section |

## Interactions

| Element | Action | Result | Feedback (<100 ms) |
|---|---|---|---|
| (none beyond sidebar navigation) | — | — | — |

## Content

| Key | Text | Notes |
|---|---|---|
| title | "In-game preview" | matches the sidebar label |
| body | "Trigger animations live and execute special moves with a single click — this mode isn't built yet." | mirrors the README's planned-scope wording |

## Accessibility

- **Keyboard order:** heading → body text (not interactive).
- **Focus after each action:** switching into this section moves focus to its heading, same as every other section — it's a real destination, not a dead end.
- **Announcements:** none beyond the section switch itself.
- **Contrast & targets:** meets the existing `web-ui-kit` AA baseline via reused tokens.
- **Motion:** none.
