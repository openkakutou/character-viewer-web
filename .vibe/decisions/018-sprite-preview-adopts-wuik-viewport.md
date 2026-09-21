---
date: 2026-09-22
status: accepted
---
# Sprite preview adopts `<wuik-viewport>`, superseding the interim raw-`<canvas>` scale-to-fit

**Context:** `.vibe/decisions/007-sprite-preview-raw-canvas-not-wuik-viewport.md` shipped the sprite preview (backlog item 005) with a plain `<canvas>` and a locally-computed integer scale-to-fit because `web-ui-kit`'s `<wuik-viewport>` (its own item 004) had shipped in a release (`v0.4.0`) whose npm publish failed, making the dependency unresolvable. `web-ui-kit`'s item 008 fixed that failure and its pipeline has since published several further releases; `npm view @openkakutou/web-ui-kit versions` now tops out well past `0.4.0`, and this repo's own installed dependency already resolves a version carrying `<wuik-viewport>`. The blocking condition backlog item 016 was filed to wait for no longer holds.

**Decision:** Wrap the sprite preview's canvas in `<wuik-viewport>` (mirroring the identical pattern already shipped in the sibling `character-editor` repo's own sprite browser) and remove the local scale-to-fit CSS/JS this preview used. The canvas keeps its native pixel size; `<wuik-viewport>`'s own `resetToFit()` is called once new pixels are drawn, giving the same "fits the stage" starting view as before plus real zoom/pan for free. `@openkakutou/web-ui-kit` is bumped to `^0.13.0` (latest resolvable at the time of this change) to make the adoption concrete, not just theoretically possible.

The `computeScaleToFit` helper this preview used stays exported from `sprite-browser.ts` — unlike this preview, the animation player (`animation-player.ts`, backlog item 007) still uses its own local scale-to-fit for its own canvas and continues to import this same helper. Migrating the animation player to `<wuik-viewport>` too is out of this item's scope (item 016 names the sprite preview specifically) and is left for its own future backlog item if wanted.

**Reason:** The dependency is now genuinely installable, which was the one and only reason decision 007 chose the interim approach over the long-term-preferred shared control. Reusing the sibling repo's already-real-browser-verified integration (`viewport.appendChild(canvas)`, a duck-typed `resetToFit()` call guarded by an optional-chained method check so it is a silent no-op under this project's jsdom test environment) avoids re-deriving an integration this org has already shipped and validated once.

**Rejected alternatives:**
- **Also migrate the animation player's own preview in the same change:** rejected — out of this backlog item's stated scope, and a distinct enough screen (its own timed playback loop, its own collision-box overlay drawn in the same canvas coordinate space) that folding it in here risks a much larger, less reviewable change for no acceptance-criteria benefit.
- **Keep the dependency range at `^0.11.1`:** rejected — `<wuik-viewport>` is already resolvable there too, but bumping to the latest resolvable release makes the "no longer blocked" fact concrete in `package.json` rather than left to a comment explaining why an old floor happens to still work.
