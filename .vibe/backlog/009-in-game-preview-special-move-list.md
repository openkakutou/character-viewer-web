---
status: todo
depends_on: [007]
---
# In-Game Preview Special Move List

## Description
List a loaded character's Statedefs and let the user force-play a chosen state's associated animation with one click — a direct Statedef trigger (like a MUGEN/Ikemen debug menu), not a simulation of real command input. Decision (confirmed with product owner): simulating actual player input against `.cmd` command files and evaluating `.cns` triggers is out of scope for this repo — `character` has no `.cmd` parser and `cns.Controller` triggers are unevaluated raw data; real input-command simulation belongs to the future `engine` repo instead.

## Acceptance Criteria
- [ ] User sees a list of the loaded character's Statedefs
- [ ] Clicking a Statedef entry plays that state's associated animation in the preview (reusing item 007's player)
- [ ] A Statedef with no clearly associated animation (e.g. no `ChangeAnim`-equivalent data available) shows a clear "no animation" state instead of failing silently
- [ ] Triggering a new state while another is playing cleanly replaces it, same as item 008's animation triggers

## Notes
Depends on item 007 (animation player). Scope explicitly excludes `.cmd` parsing and trigger/expression evaluation — see Description.
