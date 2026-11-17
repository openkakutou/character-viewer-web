---
status: todo
---
# Render OpenKakutou-exclusive 3D characters

## Description
Roadmap decision `028`: render characters whose `.def` declares a `model` (`.glb`). Load it with three.js (already used by `stage-viewer-web`), play skinned animation per 3D frame `(clip, time)`, show Clsn boxes over it as for sprites, facing = 180° rotation, palettes = `KHR_materials_variants`. Sprite frames of the same character (effects) keep rendering through the existing sprite path.

Blocked on `character` items 070 (parsing) and 071 (sample fixture).

## Acceptance Criteria
- [ ] The `character` 071 sample loads; every action plays with correct timing
- [ ] Clsn overlay aligns with the model
- [ ] Facing toggle rotates the model; palette picker switches variants
- [ ] Existing sprite characters render exactly as before (visual regression unchanged)
