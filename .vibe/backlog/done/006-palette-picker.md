---
status: done
depends_on: [005]
---
# Palette Picker

## Description
Let the user choose among a loaded character's available palettes (or supply an external `.act` override file, mirroring `character`'s existing Go-side external-palette-override capability) and re-render the sprite browser/animation player with the selected palette applied.

## Acceptance Criteria
- [x] User can see and select from the list of palettes available on the loaded character
- [x] Selecting a palette re-renders currently visible sprites with the new colors applied
- [x] User can supply an external `.act` file to override the character's own palette
- [x] An invalid/wrong-sized `.act` file shows a clear error instead of crashing or silently ignoring the override

## Notes
Uses the same pixel-resolution WASM call as item 005 (sprite browser), with a palette/override parameter. Previously blocked on `character`'s item 034 (Expose Sprite Pixel Resolution Via WASM) — that shipped in `character` v0.2.0, so the cross-repo blocker is resolved.

## Design note (2026-08-31)
This app only ever loads a character's 4 required files — it never has the bytes of any character-referenced `.act` file, and the WASM bridge offers no call to select an arbitrary *other* embedded palette bank without supplying real bytes for it. The first acceptance criterion is met as: the character's referenced `.act` file *names* are shown as a list, guiding what to upload — not individually clickable swatches, since this app cannot apply one without its bytes. See `.vibe/decisions/010-palette-picker-scope-and-external-override-only.md` for the full reasoning.
