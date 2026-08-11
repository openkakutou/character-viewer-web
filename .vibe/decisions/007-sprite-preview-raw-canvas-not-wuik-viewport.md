---
date: 2026-08-11
status: accepted
---
# Sprite preview uses a raw `<canvas>` with integer scale-to-fit, not `<wuik-viewport>`

**Context:** `web-ui-kit` now has a reusable zoom/pan/reset-to-fit viewport control (`<wuik-viewport>`, its own item 004) purpose-built for wrapping a canvas-based preview like this one — the natural choice for a sprite preview whose dimensions vary wildly (a handful of pixels for an icon, hundreds for a full-body frame). It shipped in `web-ui-kit` `v0.4.0`. But that release's tag-triggered publish workflow failed (`web-ui-kit`'s own backlog item 008 — a pre-existing `package.json`/`src/version.ts` version-constant drift, unrelated to `<wuik-viewport>` itself) before the npm publish step ran: `npm view @openkakutou/web-ui-kit versions` still tops out at `0.3.0`, and this repo's own dependency range (`^0.3.0`) cannot resolve to `0.4.0` even once it is published, without a `package.json` bump on top of that.

**Decision:** Ship the sprite preview with a plain `<canvas>` for now, sized to the selected sprite's actual pixel buffer, with `image-rendering: pixelated` for crisp scaling and a CSS-computed integer-ish scale factor (upscaling a tiny sprite so it isn't visually indistinguishable from "nothing loaded", downscaling a huge one to fit a fixed-height preview stage) computed and applied directly here rather than via any shared control. Each selection's async pixel-resolution request is tagged with a monotonically increasing counter so a slower, superseded response (the user clicked a second sprite before the first one's decode returned) is discarded instead of overwriting the current selection's preview.

**Reason:** `<wuik-viewport>` is the right long-term home for this — zoom/pan and reset-to-fit are exactly what a sprite preview wants, and re-solving that generically here would duplicate it. But it is not actually *installable* today: the dependency this repo would need does not exist on the npm registry consumers actually resolve against, and bumping to an unpublished version is not something a real install can do. Blocking this feature on an unrelated repo's release pipeline being fixed and re-run — out of this item's own scope — would leave a shippable, acceptance-criteria-complete feature stuck on someone else's infrastructure problem. `web-ui-kit`'s item 008 already tracks the root cause; its notes now also record that it broke the real `v0.4.0` publish.

**Rejected alternatives:**
- **Wait for `web-ui-kit` v0.4.0 to actually publish, then adopt `<wuik-viewport>` from the start**: rejected — open-ended external dependency on a different repo's own backlog and release cycle, for a feature that's otherwise fully buildable today.
- **Vendor/copy `<wuik-viewport>`'s source into this repo temporarily**: rejected — duplicates a shared component outside the one place (`web-ui-kit`) meant to own it, guaranteeing drift the moment the real dependency does become installable.
- **No scale adjustment at all (native pixel size only)**: rejected — a real `.sff` sheet's sprites range from a few pixels to several hundred; native size alone leaves small sprites unreadable and large ones potentially overflowing the preview area, both called out directly by the UX/design review this plan went through.

**Follow-up:** Once `web-ui-kit` `v0.4.0` (or later) is actually resolvable via npm, revisit this preview to adopt `<wuik-viewport>` and drop the local scale-to-fit math — filed as `character-viewer-web` backlog item 016.
