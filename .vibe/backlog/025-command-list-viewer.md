---
status: todo
---
# Command List Viewer

## Description
A character's .cmd defines its special moves and input motions, but the viewer cannot show them. Add a Commands section listing each command with its input sequence and timing windows, read-only.

## Acceptance Criteria
- [ ] User can open a Commands section listing every command name with its input sequence, time and buffer values
- [ ] A character without a .cmd shows an explicit empty state, not an error
- [ ] Section texts exist in English and French

## Notes
Blocked in practice on character 059 (wire .cmd into Character) shipping and the WASM bump. Use web-ui-kit components from the start (see item 023).
