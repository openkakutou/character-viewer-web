---
date: 2026-08-10
status: accepted
---
# Characteristics panel shown inline, no tab/sidebar navigation yet

**Context:** `.vibe/decisions/003-app-shell-adoption-scope.md` anticipated that the sidebar/`<wuik-tabs>` navigation region would be filled "when item 004 (Characteristics Panel) needs real navigation". Item 004's own brief frames the panel as something to display "as the first visible view" once a character loads — automatically, not behind a click. With only one real content screen existing at this point (this panel; the file input above it is an input, not a peer destination), a tab strip would have exactly one meaningful tab to switch to, disambiguating nothing.

**Decision:** Render the characteristics panel inline in the main content area, directly below the file input, appearing automatically as soon as a character finishes loading — no `<wuik-tabs>`/sidebar navigation introduced by this item. Revisit when a second real content screen exists (e.g. the sprite browser, item 005) and navigation between multiple destinations actually has something to disambiguate.

**Reason:** The item's own framing ("first visible view") is satisfied more directly by an automatic, no-click inline appearance than by a tab a user must first select — and `<wuik-tabs>` in this design system has no supported way to select a tab programmatically from outside (its selection state is a private implementation detail), so auto-switching to a "Characteristics" tab on load would require reaching into the component's internals, which the design system's own API doesn't sanction. A one-destination tab strip also adds UI chrome without helping the user choose between anything, per this item's own UX consultation.

**Rejected alternatives:**
- *Introduce `<wuik-tabs>` now with "Load" and "Characteristics" tabs, as decision 003 originally forecast.* Rejected: no supported way to auto-select the Characteristics tab on load without reaching past the component's public API; and with only one real destination, a tab strip disambiguates nothing yet.
- *Replace the file input entirely once a character loads, showing only the panel.* Rejected: the file input must stay visible/reachable so a user can load a different character afterward without a page reload — an explicit scenario in this item's own plan.
