---
status: todo
depends_on: [020]
---
# Load Character Popup For Mid-Session Switching

## Description
Add a "Load character…" toolbar action that opens a popup (reusing the existing 4-file input widget) to load a different character without a page reload, without tearing down the currently loaded character until the new one actually validates. See `.ux/screens/load-character-popup.md`.

## Acceptance Criteria
- [ ] A "Load character…" toolbar action is reachable from every section of the workspace
- [ ] Opening it shows a popup with an empty 4-slot file widget; the current character and workspace remain fully visible and usable underneath
- [ ] A failed/partial load in the popup leaves the original character and every section's state completely unaffected
- [ ] A successful load replaces the character, resets every section's own selection state to default, but keeps the currently active sidebar section selected

## Notes
Blocked on `web-ui-kit` backlog item `016-dialog-popup-component.md` — check it has shipped before starting. Depends on item `020` (workspace shell must exist to host the toolbar action and sidebar).
