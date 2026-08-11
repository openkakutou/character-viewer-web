---
status: todo
---
# Tabbed Navigation Once A Third Screen Lands

## Description
The characteristics panel and sprite browser (items 004, 005) both render inline, stacked, once a character loads — decision 005 deferred `<wuik-tabs>` navigation until a second real screen existed, and decision 008 revisited that once the sprite browser actually landed, keeping it inline for now since two stacked, internally-scrolling panels still reads fine. A third real screen (palette preview, animation playback) is the point this should be revisited for real, per decision 008's own follow-up note.

## Acceptance Criteria
- [ ] Once a third screen (e.g. palette preview or animation playback) is about to land, evaluate whether stacking it inline still reads well, or whether `<wuik-tabs>` navigation is now warranted
- [ ] If adopted: `web-ui-kit`'s `<wuik-tabs>` has a documented way to select a tab programmatically (needed so a freshly-loaded character lands on a sensible tab, not whichever was last selected) — check its current API surface before starting, since decision 003 noted this gap didn't exist at the time
- [ ] Existing panels' content/behavior is unchanged by the navigation restructuring itself

## Notes
Not a certainty this results in tabs — the acceptance criteria are about evaluating and deciding, not committing up front. See `.vibe/decisions/008-sprite-browser-stays-inline-tab-navigation-still-deferred.md`.
