---
date: 2026-09-20
status: accepted
---
# GIF export frame compositing: shared axis-anchored canvas

**Context:** Item 014 exports an `.air` Animation as an animated GIF. A GIF's logical screen has one fixed width/height shared by every frame (the `gifenc` encoder always writes each frame at position (0,0) covering the full logical screen — it exposes no per-frame x/y offset), but an animation's frames can reference sprites of different pixel dimensions (e.g. an idle "breathing" loop).

**Decision:** Before encoding, compute one shared canvas size as the union of every referenced sprite's bounding box relative to its own axis (pivot) point, then draw each frame's sprite into that shared canvas offset so its axis point lands at the same canvas position every time. A frame with no resolvable sprite (blank sentinel, or a metadata lookup miss) contributes nothing to the bounding box and is skipped when drawing (see decision 016's transparent-frame handling for the "at least one dimension" fallback).

**Reason:** This is both a technical necessity (the encoder cannot position frames independently) and the only way to avoid the character visually jumping frame to frame when sprite sizes vary. It reuses the exact axis-offset convention `animation-player.ts`'s own collision-box overlay (`computeClsnRect`) already established, rather than inventing a second coordinate convention.

**Rejected alternatives:** Sizing the canvas to the single largest frame and drawing every other frame at its native top-left (0,0) — simpler, but frames align by top-left corner instead of by axis point, producing visible jitter for any character whose sprite dimensions change between frames (a common case for breathing/idle animations).
