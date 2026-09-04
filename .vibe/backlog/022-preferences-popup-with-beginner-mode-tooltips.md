---
status: todo
depends_on: [020]
---
# Preferences Popup With Beginner-Mode Tooltips

## Description
Add a Preferences popup reachable from a toolbar icon, with a "beginner mode" toggle that turns on explanatory tooltips for MUGEN/Ikemen vocabulary (Statedef, .act, group/sprite, clsn1/clsn2…) across every section, off by default. See `.ux/screens/preferences-popup.md` and the per-section tooltip notes in `.ux/screens/characteristics-section.md`, `.ux/screens/palette-section.md`, `.ux/screens/sprite-browser-section.md`, `.ux/screens/animation-player-section.md`.

## Acceptance Criteria
- [ ] A Preferences icon in the toolbar opens a popup with a "Beginner mode" toggle, off by default
- [ ] Enabling it shows an info icon next to each MUGEN/Ikemen technical term across the Characteristics, Palette, Sprites, and Animation sections; hovering/focusing it reveals a plain-language explanation
- [ ] The setting persists for the rest of the session (not just the currently open section) and survives a character switch (item 021)
- [ ] Disabling it hides every info icon again, with no other visual change

## Notes
Blocked on `web-ui-kit` backlog item `016-dialog-popup-component.md` — check it has shipped before starting. Depends on item `020` (sections must exist in the new workspace shell).
