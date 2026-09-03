---
slug: preferences-popup
title: Preferences popup
flow: 001
status: designed
source: [file(s) implementing it — filled by /ux:implement]
---

# Preferences popup

## Purpose

Let the user turn on explanatory tooltips for MUGEN/Ikemen vocabulary (beginner mode) without imposing them on users who already know the terms — the app's one settings surface, kept intentionally minimal.

## Layout

A modal dialog (same primitive as `load-character-popup`, native `<dialog>` or the eventual `web-ui-kit` dialog — backlog item, not built in this task), opened from the toolbar's Preferences icon, over the still-visible, dimmed, inert workspace. Contains a single labelled toggle at launch; the layout should not assume this stays the only setting (leave room to grow), but nothing beyond beginner mode is in scope for this flow.

## States

| State | Trigger | What the user sees | Primary action |
|---|---|---|---|
| Default | Popup opens | "Beginner mode" toggle, off by default (matches the settled decision that technical vocabulary is the base, tooltips are opt-in) | Turn it on |
| Beginner mode on | User enables the toggle | Toggle shows on; every section's info icons (characteristics-section, palette-section, sprite-browser-section, animation-player-section) become visible next time each is shown | Turn it off, or close the popup |

## Interactions

| Element | Action | Result | Feedback (<100 ms) |
|---|---|---|---|
| Beginner-mode toggle | Click / Space | Setting flips immediately, applies across the whole session (all sections, current and future) | Toggle's visual state changes |
| Close control / Esc / backdrop click | Dismiss | Popup closes; the setting (if changed) persists for the rest of the session | Popup closes, focus returns to the Preferences toolbar icon |

## Content

| Key | Text | Notes |
|---|---|---|
| title | "Preferences" | |
| beginner-mode.label | "Beginner mode" | |
| beginner-mode.hint | "Show explanations for MUGEN/Ikemen terms across the app." | |

## Accessibility

- **Keyboard order:** on open, focus moves to the toggle; Tab/Shift+Tab cycles only within the popup (focus trap); Esc closes it.
- **Focus after each action:** on close (any path), focus returns exactly to the toolbar's Preferences icon.
- **Announcements:** `role="dialog"`, `aria-modal="true"`, labelled by its own heading; rest of the app inert while open — identical contract to `load-character-popup`, since both will eventually share the same underlying `web-ui-kit` primitive.
- **Contrast & targets:** same AA baseline as every other control.
- **Motion:** open/close is instant or a simple fade — no kit motion tokens exist yet.
