---
status: todo
depends_on: [004]
---
# Display Full Character Metadata (Author/Credits)

## Description
Once `character`'s `LoadBytes` JSON contract exposes full `CharacterInfo` fields (author, etc. — cross-repo `character` backlog item 038), surface them in the characteristics panel.

## Acceptance Criteria
- [ ] Author/credit fields, when present, are displayed in the characteristics panel
- [ ] Missing/empty metadata fields degrade gracefully (no blank crash, no "undefined" shown)

## Notes
Depends on cross-repo `character` item 038 (Thread Full CharacterInfo Fields Through LoadBytes JSON Contract).
