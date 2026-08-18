---
date: 2026-08-18
status: accepted
---
# Animation Player Timing, Looping, And Collision Overlay Design

**Context:** Backlog item 007 (Animation Player) needs playback timing rules, blank-frame handling, and a collision-box overlay, none of which are fully specified by the existing `Animation`/`Frame`/`ClsnBox` data or this repo's own docs. Consulted the UI/UX and frontend-design experts before finalizing this.

**Decision:**
1. One game tick = 1/60 second (60 ticks/second), matching MUGEN/Ikemen GO's standard engine rate.
2. A non-positive `time` value (including MUGEN's real "-1 = hold forever" convention) is clamped to a minimum 1-tick hold — true infinite-hold semantics are out of scope for this item, since the acceptance criteria don't require them.
3. Reaching the end of the frame list (during autoplay or a manual step) wraps back to `loopStart` (clamped into `[0, frames.length-1]`, defaulting to 0 if out of range) only when the Loop toggle is on; otherwise playback/stepping stops on the last frame.
4. A frame is blank when its `group` and/or `image` is negative (matching the `character` library's own `IsBlank()` convention — not just the `-1,-1` pair named in the acceptance criteria) — rendered as an empty stage with a distinct, non-error, non-"loading" status message, no sprite decode attempted.
5. Collision boxes are positioned in the same top-left-origin, y-down pixel space as the sprite image itself, offset by the sprite's `axisX`/`axisY` — a box's on-canvas rectangle is `(axisX+left, axisY+top)` to `(axisX+right, axisY+bottom)`, drawn directly on the same native-resolution canvas as the sprite pixels (before any CSS scaling), so it stays pixel-aligned automatically at any zoom.
6. Overlay colors are two fixed, non-`--wuik-*` values (attack/`clsn1` and vulnerability/`clsn2` are semantic domain colors, not UI chrome) chosen for adequate contrast against both light and dark theme backgrounds — not switched per theme — and distinguished by stroke style (solid vs. dashed) as well as hue, for colorblind accessibility. `clsn2` is drawn first so overlapping `clsn1` boxes stay visible on top.

**Reason:** None of these rules are specified anywhere in this repo or upstream; picking clear, documented defaults now (rather than leaving them implicit in code) keeps future items from having to reverse-engineer this item's behavior. The simplifications (fixed tick rate, no infinite-hold, fixed non-theme-switching overlay colors) trade a small amount of engine fidelity for a scope that matches this item's acceptance criteria without adding a new external-effect surface (theme detection) this item doesn't otherwise need.

**Rejected alternatives:**
- True "-1 = hold forever" semantics — would need a defined interaction with the Loop toggle (does looping ever resume from an infinite hold?) that the acceptance criteria don't ask for; deferred to a future item if ever needed.
- Per-theme overlay color switching via `prefers-color-scheme`/`data-theme` detection — would add a new injectable external effect for a cosmetic refinement the acceptance criteria don't require; a single theme-agnostic high-contrast pair covers the substantive need (visibility in both themes).
