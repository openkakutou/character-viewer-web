---
status: todo
depends_on: [005]
---
# Palette Picker

## Description
Let the user choose among a loaded character's available palettes (or supply an external `.act` override file, mirroring `character`'s existing Go-side external-palette-override capability) and re-render the sprite browser/animation player with the selected palette applied.

## Acceptance Criteria
- [ ] User can see and select from the list of palettes available on the loaded character
- [ ] Selecting a palette re-renders currently visible sprites with the new colors applied
- [ ] User can supply an external `.act` file to override the character's own palette
- [ ] An invalid/wrong-sized `.act` file shows a clear error instead of crashing or silently ignoring the override

## Notes
Uses the same pixel-resolution WASM call as item 005 (sprite browser), with a palette/override parameter. Previously blocked on `character`'s item 034 (Expose Sprite Pixel Resolution Via WASM) — that shipped in `character` v0.2.0, so the cross-repo blocker is resolved.
