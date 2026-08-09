---
date: 2026-08-09
status: accepted
---
# Adopt `web-ui-kit`'s app shell as the root frame, with a deliberately minimal scaffold-stage scope

**Context:** Backlog item 011 adopts the org's shared design system (`@openkakutou/web-ui-kit`) before any real screen exists — only a placeholder version string is displayed today. `web-ui-kit`'s `<wuik-app-shell>` provides toolbar, sidebar, and main-content regions; only the main content has anything to show right now.

**Decision:**
- Use `<wuik-app-shell>` as the root frame, with `<wuik-toolbar>` (holding the app title) slotted into the toolbar region and the version string in the main content region.
- Do not slot anything into the sidebar (or use `<wuik-tabs>`) yet — `<wuik-app-shell>`'s empty named slots collapse to zero size with no reserved gutter (`web-ui-kit`'s own `.vibe/decisions/005-app-shell-empty-slot-collapse.md`), so omitting them renders nothing broken or dead; they will be filled when item 004 (Characteristics Panel) needs real navigation.
- Ship with `web-ui-kit`'s default light theme only. `web-ui-kit` only switches theme via an explicit `data-theme="dark"` ancestor attribute, with no `prefers-color-scheme` fallback — so this is a conscious "light only for now" choice, not an accidental one, and no dark-mode toggle is added in this item.
- Add explicit accessibility landmarks (`role="banner"` on the toolbar, a native `<main>` element for the content region) ourselves rather than assuming the library supplies them — `web-ui-kit`'s toolbar/app-shell components do not set ARIA landmark roles internally.

**Reason:** Matches the item's brief ("adopt before building any real screen") without inventing UI that has no purpose yet, and avoids two silent-drift risks flagged during planning: an empty sidebar reading as broken chrome, and shipping without landmarks under the mistaken assumption the library provides them automatically.

**Rejected alternatives:**
- *Slot an empty/placeholder sidebar now* — rejected: nothing to put in it yet, and an empty `<wuik-panel>` sidebar would look like unfinished chrome rather than an intentional layout.
- *Add a dark/light theme toggle now* — rejected: out of scope for a design-system adoption item; deferred to whichever future item introduces user-facing settings.
</content>
