---
status: todo
depends_on: [003]
---
# Characteristics Panel

## Description
Once a character is loaded through the file input (item 003) and the WASM bridge (item 002), display its name, animation count, sprite count, and list of state (Statedef) numbers as the first visible view. This is the first end-to-end vertical slice of the app — it proves the full load pipeline (file input → WASM bridge → typed data → UI) works before any visual/pixel rendering is attempted.

## Acceptance Criteria
- [ ] After loading a valid character, the panel displays its name
- [ ] The panel displays the total animation count and total sprite count
- [ ] The panel lists every Statedef number present in the loaded character
- [ ] Loading a character with zero animations/sprites/states displays that explicitly (e.g. "0"), not a blank or broken section

## Notes
Currently limited to what `character.Character`'s JSON exposes (`name`, `animations`, `sprites`, `stateDefs`) — richer `CharacterInfo` fields (author, etc.) are parsed by `character`'s `def` package but not yet threaded through `LoadBytes`'s JSON contract; out of scope here unless a future `character` item adds them.
