---
status: todo
---
# Launch Screen And Workspace Shell

## Description
Replace the current always-stacked, whole-page-scrolling layout with a launch screen (a full-frame first-character-load step) that transitions into a persistent workspace shell — toolbar + a vertical sidebar section list (Characteristics, Palette, Sprites, Animation) + one section visible at a time in main — with no page-level scroll. See `.ux/flows/001-character-inspection-workspace.md` and `.ux/decisions/001-workspace-navigation-model.md`.

## Acceptance Criteria
- [ ] With no character loaded, the app shows a full-frame launch screen (today's file-input widget, unchanged) with no page-level scrollbar
- [ ] On successful load, the app transitions to a workspace shell landing on the Characteristics section, with Palette/Sprites/Animation reachable from a vertical sidebar list
- [ ] Switching sections preserves each section's own state (expanded groups, selected sprite, selected animation, playback frame, loop/collision toggles) instead of resetting it
- [ ] Leaving the Animation section while it is playing pauses it; returning shows it paused at the same frame, not resumed automatically
- [ ] No page-level scroll occurs at any point at ≥1024px viewport width — only a section's own content area scrolls internally

## Notes
Blocked on `web-ui-kit` backlog item `016-dialog-popup-component.md`'s sibling, item `017-wuik-tabs-vertical-orientation.md` (`<wuik-tabs>` vertical orientation) — check it has shipped before starting.

Supersedes this repo's own item `017-tabbed-navigation-once-a-third-screen-lands.md`, whose "evaluate once a third screen lands" question is now answered by `.ux/decisions/001-workspace-navigation-model.md`; consider removing that item once this one is under way (`/vibe:backlog remove 17`).

Full screen-level detail: `.ux/screens/launch-screen.md`, `.ux/screens/workspace-shell.md`, `.ux/screens/characteristics-section.md`, `.ux/screens/palette-section.md`, `.ux/screens/sprite-browser-section.md`, `.ux/screens/animation-player-section.md`.
