---
slug: characteristics-section
title: Characteristics section
flow: 001
status: designed
source: [file(s) implementing it — filled by /ux:implement]
---

# Characteristics section

## Purpose

Show the loaded character's identity and overall shape at a glance: name, animation/sprite counts, and its full Statedef list.

## Layout

Unchanged content from the current `characteristics-panel.ts` (name → stat cluster → scrollable Statedef grid), now hosted as the workspace's main-slot content instead of a page-stacked panel. Fills the available height; the Statedef grid keeps its own capped-height `overflow-y: auto` (already true today) so it never needs the page to scroll. When beginner mode is on (`preferences-popup`), MUGEN terms this section uses ("Statedef", state numbers) get an info icon next to the heading revealing a short explanation on hover/focus — not inline text, so expert users see no added clutter.

## States

| State | Trigger | What the user sees | Primary action |
|---|---|---|---|
| Success | Character loaded, section selected | Name, Animations/Sprites counts, sorted Statedef list | Switch section or inspect a state number |
| Empty states list | Character has zero Statedefs (edge case) | Existing "no states" message (unchanged) | Switch section |
| Re-entered after another section | User returns via sidebar | Same content, scroll position of the Statedef grid restored if it was scrolled | Continue browsing |
| Reset after character switch | `load-character-popup` succeeds | Content re-renders for the new character; no leftover scroll position from the old one | Continue browsing |

## Interactions

| Element | Action | Result | Feedback (<100 ms) |
|---|---|---|---|
| Beginner-mode info icon (new) | Hover / focus | Tooltip explains the term in plain language | Tooltip appears |

## Content

| Key | Text | Notes |
|---|---|---|
| (all existing content keys) | unchanged | see `src/viewer/characteristics-panel.ts` |
| tooltip.statedef | "A named mode of the character's behavior — standing, an attack, a hit reaction…" | shown only in beginner mode; wording mirrors `.vibe/glossary.md`'s "State" entry |

## Accessibility

- **Keyboard order:** heading → stat cluster (not interactive) → Statedef grid (scrollable region, focusable if it can receive keyboard scroll) → beginner-mode info icons if present, each independently focusable and dismissible with Esc.
- **Focus after each action:** switching into this section from the sidebar moves focus to its heading (per `workspace-shell`).
- **Announcements:** none beyond what already exists; tooltip content is exposed via `aria-describedby` on the info icon, not only on hover, so it's available to screen-reader and keyboard users alike.
- **Contrast & targets:** unchanged, already AA.
- **Motion:** none.
