---
status: todo
depends_on: [007]
---
# In-Game Preview Animation Triggers

## Description
Add an in-game preview view listing a loaded character's animations by name/number, each with a button that triggers it to play live in the preview, reusing the animation player built in item 007.

## Acceptance Criteria
- [ ] Preview view lists every animation number available on the loaded character
- [ ] Clicking an animation's button plays it immediately in the preview area
- [ ] Triggering a new animation while one is already playing cleanly replaces it (no overlapping/stuck playback)
- [ ] The list remains usable (scrollable, no layout break) for characters with a large number of animations

## Notes
None.
