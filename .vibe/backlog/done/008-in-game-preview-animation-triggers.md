---
status: done
depends_on: [007]
---
# In-Game Preview Animation Triggers

## Description
Add an in-game preview view listing a loaded character's animations by name/number, each with a button that triggers it to play live in the preview, reusing the animation player built in item 007.

## Acceptance Criteria
- [x] Preview view lists every animation number available on the loaded character
- [x] Clicking an animation's button plays it immediately in the preview area
- [x] Triggering a new animation while one is already playing cleanly replaces it (no overlapping/stuck playback)
- [x] The list remains usable (scrollable, no layout break) for characters with a large number of animations

## Notes
None.
