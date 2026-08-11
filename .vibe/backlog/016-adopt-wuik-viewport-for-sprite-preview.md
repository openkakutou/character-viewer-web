---
status: todo
---
# Adopt `<wuik-viewport>` For Sprite Preview

## Description
The sprite browser (item 005) renders its selected-sprite preview with a plain `<canvas>` and a locally-computed integer scale-to-fit, instead of `web-ui-kit`'s purpose-built `<wuik-viewport>` zoom/pan/reset-to-fit control — because that control shipped in `web-ui-kit` `v0.4.0`, whose npm publish failed (`web-ui-kit`'s own backlog item 008) and is therefore not actually installable yet. See `.vibe/decisions/007-sprite-preview-raw-canvas-not-wuik-viewport.md` for the full reasoning.

Once `web-ui-kit` `v0.4.0` (or later) is actually resolvable via npm, swap the sprite preview over to `<wuik-viewport>` and drop the local scale-to-fit math — gaining real zoom/pan for free, not just a fit-to-frame view.

## Acceptance Criteria
- [ ] `@openkakutou/web-ui-kit` dependency bumped to a version that actually resolves `<wuik-viewport>` from npm
- [ ] The sprite preview's canvas is wrapped in `<wuik-viewport>` instead of the local scale-to-fit CSS/JS
- [ ] Existing sprite browser behavior (selection, loading, error states) is unchanged
- [ ] The local integer scale-to-fit code this replaces is removed, not left dead alongside it

## Notes
Blocked on `web-ui-kit`'s own item 008 (version-constant drift) being fixed and a subsequent release actually publishing to npm — check `npm view @openkakutou/web-ui-kit versions` before starting.
