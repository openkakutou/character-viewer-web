---
date: 2026-09-23
status: accepted
---
# Mid-session character switch re-renders section containers instead of recreating `<wuik-tabs>`

**Context:** Backlog item 021 needs a successful "Load character…" popup submission to reset every section's own state to default while keeping the sidebar's currently active section selected. `<wuik-tabs>` has no public API to select a specific tab index after mount — it always lands on index 0 on its first `slotchange`-driven build (see `.vibe/decisions/011-workspace-shell-tabs-composition-and-section-switch-detection.md`).

**Decision:** `renderWorkspaceShell` never recreates `<wuik-tabs>`/the `<wuik-tab-panel>` elements for a character switch. It keeps them mounted for the whole session and instead re-invokes each section's own render function (`renderCharacteristicsPanel`, `renderSpriteBrowser`, etc.) on its already-existing container, pausing whichever previous playback handles exist first. Each section's render function already tears down and rebuilds its own DOM from scratch, which is what resets that section's state — the sidebar selection itself is simply never touched, so it stays exactly where it was with no extra bookkeeping.

**Reason:** Reusing the exact containers keeps the reset behavior identical to how a section already resets when first mounted, with no new state-reset code path to maintain, and sidesteps `<wuik-tabs>`'s missing selection API entirely rather than working around it.

**Rejected alternatives:**
- *Fully recreate the whole workspace shell (`renderWorkspaceShell` again) and simulate a click on the previously active tab's button (reaching into `<wuik-tabs>`'s shadow DOM) to restore the selection* — rejected: works, but depends on an undocumented internal structure (the tab button order) purely to undo a side effect (losing the selection) that recreating the tabs caused in the first place; also re-triggers `<wuik-tabs>`'s own slotchange rebuild and the `MutationObserver`'s initial-mount focus logic for no benefit.
- *Add a `selectedIndex` attribute/property to `web-ui-kit`'s `<wuik-tabs>`* — rejected: a cross-repo change with its own release cycle, out of proportion to this app-local problem, and decision 011 already established working within the kit's current public surface as this app's convention.
