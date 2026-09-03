---
id: 001
date: 2026-09-03
status: accepted
flow: 001
---

# Workspace navigation model: launch screen + vertical sidebar

**Context:** Redesigning `character-viewer-web` away from its current always-stacked, whole-page-scrolling layout (5 panels always visible, page scrolls) toward a desktop-application-feeling interface with no whole-page scroll, per the user's explicit request for popups, preferences, tabs, and steps. The interaction model chosen here governs how the user moves between the app's 5 (+1 future) sections.

**Options considered:**
- **A — Launch screen + vertical sidebar (chosen):** the first character load is a dedicated full-frame step; once loaded, the app becomes a persistent workspace (`<wuik-app-shell>` toolbar + a vertical section list in the sidebar slot) showing one section at a time in main.
- **B — Vertical sidebar from the start:** same workspace shell, but no separate launch step — the file-loading widget is simply the first item in the sidebar list, visible from the very first paint.
- **C — Horizontal top tab strip:** a conventional tab bar under the toolbar, using `<wuik-tabs>` exactly as it exists in `web-ui-kit` today, with the file-loading widget as one of the tabs.

**Decision:** Option A.

**Reason:**
- The user's request explicitly named both "des onglets" and "des étapes" — option A is the only one that honestly earns both: the launch screen is a real, singular step (there is nothing else to show before a character exists), and the sidebar list is a real desktop-application-style section switcher once one does.
- The platform-conventions expert recommended a left-hand vertical list over top tabs specifically because a browser tab already owns the top edge of the window — another horizontal strip directly under the toolbar reads as "more web tabs," undermining the desktop-app effect the user asked for. A vertical list (the pattern real MUGEN/Ikemen desktop tools and general creative/inspector tools like Blender or Photoshop use) doesn't compete with that browser chrome.
- Splitting "first load" from "switch to a different character" (a popup, once already in the workspace) lets the currently loaded character stay fully intact and browsable while a new one is being validated — required by both the flows and states expert consultations, and impossible to express cleanly if the file-loading widget were just another permanently-selectable sidebar/tab entry (option B/C), which would leave a stale "loaded" state sitting inertly next to the tab a user just switched away from.
- Both A and B need the same `web-ui-kit` extension (vertical orientation for `<wuik-tabs>`, which today only supports horizontal Left/Right arrow-key navigation) — tracked as a backlog item per the user's own instruction, not built now. Option C alone would need no kit extension, but was rejected because it directly undermines the stated goal (desktop-app feel) for a smaller implementation cost, which isn't the trade-off worth making here.

**Consequences:**
- This repo's own backlog gains a new item (write the launch-screen ↔ workspace transition, the "Load character…" popup, the sidebar-driven section switching, per-section state preservation).
- `web-ui-kit`'s backlog gains two new items (tracked via `/vibe:backlog` in that repo, not implemented here): a dialog/popup primitive (needed by both `load-character-popup` and `preferences-popup`), and vertical-orientation support for `<wuik-tabs>` (Up/Down roving-tabindex navigation, vertical layout).
- Until both `web-ui-kit` items land, this repo's `/ux:implement` pass has no primitive to build the sidebar list or the popups against — the flow and screens are still worth specifying now (this decision documents the target shape), but implementation is blocked on those two dependencies, consistent with how this project has handled upstream blocks before (see `CLAUDE.md`'s WASM-dependency section).
- A first-time user sees the app's full scope (every section, even disabled ones with an explanation) only after the launch screen's one step, not on the very first paint — a deliberate trade against option B, accepted because it keeps the "step" honest rather than decorative.
