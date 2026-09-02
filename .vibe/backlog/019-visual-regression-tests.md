---
status: todo
---
# Visual Regression Tests

## Description
Add automated Playwright screenshot-comparison tests covering this app's real rendered output — the sprite browser's decoded `<canvas>`, the animation player mid-playback (with and without the Clsn box overlay), and the palette picker's recolored preview — loaded from a real character fixture, not blank/default state. See roadmap decision `024-visual-regression-testing-via-playwright-screenshots.md` for the shared approach.

## Acceptance Criteria
- [ ] The app's Playwright config extends `web-ui-kit`'s shared visual-testing config/fixture
- [ ] Baseline screenshots exist for: a decoded sprite in the sprite browser, the animation player on a specific frame with the Clsn overlay on and off, and the palette picker's live-recolored preview after applying an override `.act`
- [ ] `npm run test:visual` runs these in CI as its own job, separate from `npm test`, and fails the build on a diff
- [ ] A real, deliberate rendering regression (verified by temporarily breaking one of the covered paths, then reverting) is caught by this suite

## Notes
Depends on `web-ui-kit` backlog item `013-visual-regression-shared-playwright-config-and-component-snapshots` landing first.
