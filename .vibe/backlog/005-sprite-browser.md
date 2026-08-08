---
status: todo
depends_on: [004]
---
# Sprite Browser

## Description
Let the user browse every sprite group/image in a loaded character and see its actual decoded pixels (not just metadata). This is blocked on a cross-repo prerequisite: `character`'s WASM entrypoint currently exposes only sprite metadata (group, image, width, height, axis, palette index) — no decoded pixel/color data — per `character`'s `.vibe/decisions/019-wasm-entrypoint-byte-buffer-loading-and-json-contract.md`, which explicitly deferred pixel/palette resolution "for a future item once character-viewer-web actually needs to render sprites". That future item must land in `character`'s own backlog first (tracked there) before this item can render real images.

## Acceptance Criteria
- [ ] User can browse the full list of sprite groups/images for a loaded character
- [ ] Selecting a sprite renders its actual decoded pixels at correct dimensions
- [ ] A sprite using an unsupported/corrupt pixel format shows a clear placeholder/error instead of a broken image
- [ ] Large sprite sheets (hundreds of sprites) remain browsable without freezing the UI

## Notes
Blocked until `character` exposes a pixel-resolution WASM call (new cross-repo backlog item in `character`, mirroring its existing Go-side `ResolvePixels`/`ResolveV1Palette`/`ResolveV2Palette`). Do not start implementation until that call exists and its JS contract is confirmed.
