---
status: todo
depends_on: [005]
---
# Animation Player

## Description
Play back a loaded character's animations frame by frame, using each frame's resolved sprite image and its timing from the `air.Animation` data, with an optional overlay toggle showing each frame's collision boxes (`ClsnBox`).

## Acceptance Criteria
- [ ] User can select an animation and play it back with correct per-frame timing
- [ ] User can pause, step frame-by-frame, and loop playback
- [ ] Toggling the collision box overlay draws each frame's `ClsnBox` rectangles over the sprite
- [ ] A frame referencing a blank sprite (`-1,-1` sentinel) renders as an empty/blank frame instead of an error

## Notes
Depends on item 005's sprite rendering pipeline. The former cross-repo blocker — `character`'s item 034 (Expose Sprite Pixel Resolution Via WASM) — shipped in `character` v0.2.0, so nothing upstream blocks this anymore.
