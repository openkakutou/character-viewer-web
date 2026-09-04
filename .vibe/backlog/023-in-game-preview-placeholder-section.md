---
status: todo
depends_on: [020]
---
# In-Game Preview Placeholder Section

## Description
Add a real, clickable "In-game preview" entry to the workspace sidebar leading to a "coming soon" screen, so the app's full intended shape is visible even though the actual in-game preview mode (items 008, 009) isn't built yet. See `.ux/screens/in-game-preview-section.md`.

## Acceptance Criteria
- [ ] "In-game preview" appears as a real, enabled sidebar entry (not disabled/greyed out)
- [ ] Selecting it shows a short explanation of the planned mode (trigger animations live, one-click special moves) and that it isn't built yet
- [ ] Selecting it and returning to another section behaves exactly like any other section switch (state preserved elsewhere, no page scroll)

## Notes
This is a placeholder only — the real mode is items `008` and `009`, unaffected by this item. Depends on item `020` (workspace shell/sidebar must exist).
