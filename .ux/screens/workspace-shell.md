---
slug: workspace-shell
title: Workspace shell
flow: 001
status: designed
source: [file(s) implementing it — filled by /ux:implement]
---

# Workspace shell

## Purpose

Persistent frame the user lives in for the rest of the session once a character is loaded: identifies the current character, hosts global actions (load a different character, preferences), and switches between the 6 sections without ever scrolling the page itself.

## Layout

`<wuik-app-shell>` filled to `100dvh` (not `100vh`, so a mobile browser's address-bar resize can't reintroduce page scroll even though desktop is the priority):
- **Toolbar slot** (`<wuik-toolbar>`): app title, current character's name, a "Load character…" button (opens `load-character-popup`), a Preferences icon button (opens `preferences-popup`) at the trailing edge.
- **Sidebar slot**: a vertical section list — Characteristics, Palette, Sprites, Animation, In-game preview — built by extending `<wuik-tabs>` with a vertical orientation (decision 001; tracked as a `web-ui-kit` backlog item, not yet built). Each entry shows an icon + label; the active one is visually distinct (per `<wuik-tabs>`'s existing `aria-selected` styling, adapted to a vertical layout).
- **Main slot**: exactly one section's content at a time, filling the remaining space; that section's own content scrolls internally if it doesn't fit — the shell itself never does.

At narrow widths (safety net, not the design priority per product.md), the sidebar collapses to icons-only rather than disappearing, so section switching stays possible without reintroducing a hidden/hamburger-menu pattern that would need its own new component.

## States

| State | Trigger | What the user sees | Primary action |
|---|---|---|---|
| First load | Launch screen just succeeded | Shell appears with Characteristics active; other sections newly enabled | Browse Characteristics or switch section |
| Section disabled | (theoretically unreachable in this design — a character is always loaded once the shell exists) | n/a: the shell only ever renders once a character is loaded; the "no character yet" case is `launch-screen`'s job entirely, not a shell state | n/a |
| Switching sections | User clicks a different sidebar entry | Previous section's content is hidden (not destroyed — its DOM and state stay mounted, per the states expert's requirement to preserve selections and keep the existing stale-decode-token guards meaningful); new section's content shows, scrolled to its own last position | Interact with the new section |
| Loading a different character | User completes `load-character-popup` successfully | Toolbar name updates; every section's own internal state resets to its default; the sidebar's currently active section stays selected | Continue browsing the new character |
| Error loading a different character | `load-character-popup` shows a per-slot error | Shell and every section stay exactly as they were with the original character; nothing here changes | Retry in the popup |

## Interactions

| Element | Action | Result | Feedback (<100 ms) |
|---|---|---|---|
| Sidebar entry | Click / Enter / Space | Main content swaps to that section; focus moves to the section's own heading | Visual selected-state change on the sidebar entry |
| Sidebar entry (In-game preview) | Click | Main content swaps to `in-game-preview-section`'s "coming soon" screen — a real, reachable screen, not a dead disabled control | Same as any other section |
| "Load character…" toolbar button | Click | Opens `load-character-popup` over the still-visible workspace | Popup appears, focus moves inside |
| Preferences icon | Click | Opens `preferences-popup` over the still-visible workspace | Popup appears, focus moves inside |
| Animation section, when navigated away from while playing | (automatic) | Playback pauses at its current frame | Playback controls in `animation-player-section` show paused state next time it's viewed |

## Content

| Key | Text | Notes |
|---|---|---|
| toolbar.load-character | "Load character…" | ellipsis signals it opens a popup, per common desktop convention |
| toolbar.preferences | "Preferences" (icon + accessible name; icon alone is not a name per accessibility consultation) | gear icon |
| sidebar.characteristics | "Characteristics" | |
| sidebar.palette | "Palette" | |
| sidebar.sprites | "Sprites" | |
| sidebar.animation | "Animation" | |
| sidebar.in-game | "In-game preview" | |
| sidebar.in-game.badge | "Coming soon" | shown next to the label, not relied on alone (also stated in the section's own content) |

## Accessibility

- **Keyboard order:** toolbar controls (title is not focusable, "Load character…", Preferences) → sidebar section list (roving tabindex, one stop) → active section's own content.
- **Focus after each action:** switching sections moves focus to the new section's heading, never left on the sidebar or lost to `body`; the workspace's very first appearance (after launch-screen succeeds) moves focus to the Characteristics heading.
- **Announcements (live regions / screen reader):** section switches are structural (a real `role="tab"`/`aria-selected` change per `<wuik-tabs>`'s existing pattern, extended vertically), so a screen reader announces the newly selected tab through normal semantics — no extra live region needed for this alone. A character switch (toolbar name updates) should get one live-region announcement ("Now showing {name}") since it isn't itself a focus-moving event.
- **Contrast & targets:** sidebar entries and toolbar buttons meet the existing `web-ui-kit` AA baseline; the disabled/aria-disabled "In-game preview" distinction (used elsewhere, not here since this entry is actually clickable) doesn't apply to this screen.
- **Motion:** section switching is instant (no kit motion tokens exist yet, per inventory's known gaps) — no slide/fade animation to build or maintain.
