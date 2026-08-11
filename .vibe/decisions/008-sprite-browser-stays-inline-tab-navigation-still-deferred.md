---
date: 2026-08-11
status: accepted
---
# Sprite browser also renders inline; tab/sidebar navigation stays deferred

**Context:** Decision 005 kept the characteristics panel inline rather than
behind `web-ui-kit`'s `<wuik-tabs>`, explicitly "as long as it's the only
real destination," and named its own revisit trigger: "deferred until a
second real screen exists and there's something to disambiguate." The
sprite browser (item 005 of this repo's backlog, unrelated numbering
coincidence to decision 005) is exactly that second real screen — the
trigger decision 005 named has now actually happened.

**Decision:** The sprite browser still renders inline, stacked below the
characteristics panel, not behind a tab. Real-browser verification (a 539-
sprite character, both light and dark themes) shows this reads fine: each
panel keeps its own bounded height (the state list and the sprite list both
already scroll internally rather than growing the page), so the added
vertical stack costs one extra scroll, not a cluttered or confusing page.

**Reason:** Introducing tab navigation is a bigger, cross-cutting change
than this one item's own scope — it touches how the *existing*
characteristics panel is presented too, not just where the new screen
goes, and `web-ui-kit`'s `<wuik-tabs>` (per decision 003's own note) still
has no supported way to select a tab programmatically from outside, which
matters here since a freshly-loaded character should show its content
immediately, not land on whichever tab happened to be selected before.
Solving that integration gap belongs to whichever item actually introduces
tabbed navigation, not to this one. Decision 005's own trigger condition is
real, but "the condition is met" doesn't by itself make navigation the
right shape yet — the actual rendered result (verified, not assumed) is
still legible without it.

**Rejected alternatives:**
- **Add `<wuik-tabs>` navigation now, as part of this item**: rejected —
  meaningfully out of this item's scope (restructures the characteristics
  panel's presentation too, not just where the sprite browser lives), and
  blocked on `<wuik-tabs>`'s own "no programmatic tab selection" gap that
  a freshly-loaded character's UX depends on.

**Follow-up:** Revisit again once a *third* real screen (palette preview,
animation playback) lands — three stacked panels is a much more likely
point to actually need navigation than two. Filed as
`character-viewer-web` backlog item `017`.
