---
date: 2026-09-20
status: accepted
---
# "Stand" animation identification and GIF export filenames

**Context:** Item 014 adds a one-click "Export Stand" shortcut. `CharacterData`'s Animation type carries only a numeric `.air` Action number — no name — so "Stand" cannot be resolved by matching text.

**Decision:** "Stand" is identified as Animation number 0, matching MUGEN/Ikemen GO's own hard-coded engine convention (Action 0 = the standing animation, State 0 = the standing state) — the same convention behind the `standN.gif` preview files `sff`'s `.vibe/fixture-sources.md` documents real character folders shipping. No Animation numbered 0 surfaces as a clear inline error on click, per the backlog item's acceptance criteria, rather than disabling the button up front (same "stays clickable, shows a distinct status" convention `special-move-list.ts` already established for a row with nothing to resolve). Exported filenames are `<sanitized-character-name>-anim<N>.gif` for the general export and `<sanitized-character-name>-stand.gif` for the shortcut; this app has no reliable way to know which palette-file "slot" (`pal1`, `pal2`, …) an uploaded override corresponds to, so the numbered `standN.gif`-per-palette convention real tooling uses is not reproduced — the unnumbered `stand.gif` fallback `sff`'s fixture notes describe some real characters shipping (when a numbered set isn't available) is used instead.

**Reason:** Animation 0 is the only convention-based signal actually available in the loaded data; resolving "Stand" via a Statedef's `anim` field instead would conflate a State (behavior) concept with an Action (visual) concept this app deliberately keeps distinct (see the Animation/State glossary entries), and MUGEN's own hard requirement that Action 0 exist as the character's standing animation makes it the more direct, more universally reliable signal.

**Rejected alternatives:** Resolving "Stand" through State 0's `anim` header field (`resolveStateAnimation`, already used by the Special Moves list) — rejected because it depends on a State/Statedef existing and being wired correctly, an extra point of failure Animation 0 doesn't have, for a feature that is fundamentally about an Action, not a State. Numbering exported filenames by palette slot to mirror `standN.gif` — rejected as unimplementable: this app never has the bytes of a character's own referenced `.act` files, only an arbitrary user-uploaded override with no known slot index (see the Palette override glossary entry).
