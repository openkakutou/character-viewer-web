---
status: todo
depends_on: [007]
---
# Animated GIF Export For Animations

## Description
Let the user export any loaded animation as a downloadable animated GIF, built from the same resolved-sprite + palette pipeline the animation player (item 007) already uses, with per-frame timing taken from the `air.Animation` data. Add a one-click shortcut specifically for the "Stand" animation, since that is the conventional preview animation exported by tools like Fighter Factory.

## Acceptance Criteria
- [ ] User can export the currently loaded/selected animation as an animated GIF, with each frame's resolved sprite (current palette applied) and correct per-frame duration
- [ ] A dedicated one-click "Export Stand" shortcut exports the character's "Stand" animation without requiring the user to first locate and select it in the animation list
- [ ] A frame referencing a blank sprite (`-1,-1` sentinel) exports as an empty/transparent frame instead of erroring or aborting the export
- [ ] Exporting an animation that doesn't exist (e.g. no "Stand" animation defined) surfaces a clear error state instead of a silent failure or broken download

## Notes
Motivated by real Ikemen GO character folders that ship `standN.gif` files (one per palette, e.g. `stand1.gif` ↔ `pal1`) — animated preview renders produced by Fighter Factory. Sibling repo `sff`'s `.vibe/fixture-sources.md` documents these as ground-truth, palette-resolved renders usable to validate `sff`'s own sprite/palette decoding. Being able to generate comparable GIFs from this viewer (same sprite + palette + animation data, different tool) would give `sff` an independent way to produce or cross-check that kind of fixture, and is generally useful as a standalone export feature regardless.

Depends on item 007's playback pipeline (resolved sprite per frame, per-frame timing) — this item adds the GIF-encoding/export layer on top of it, not a new rendering path.
