---
status: done
depends_on: [001]
---
# WASM Bridge Module

## Description
Add `src/wasm/`, the bridge between this app and the `character` WASM module: load `wasm_exec.js` and instantiate `public/wasm/character.wasm` client-side, then expose a typed TypeScript wrapper around the global `OpenKakutouCharacter.load(defBytes, airBytes, sffBytes, cnsBytes)` call. The wrapper parses the module's `{character, error}` JSON contract into typed TS interfaces (`CharacterData`, `Animation`, `Frame`, `ClsnBox`, `SpriteGroup`, `Sprite`, `StateDef`, `Controller`) mirroring the Go-side JSON tags, and surfaces a clear typed error instead of throwing on malformed/missing input.

## Acceptance Criteria
- [ ] The WASM module loads and instantiates successfully in a browser/jsdom test environment
- [ ] Calling the wrapper with valid `.def`/`.air`/`.sff`/`.cns` byte buffers returns a typed `CharacterData` object matching the Go JSON shape
- [ ] Calling the wrapper with malformed or missing input returns a typed error result instead of throwing
- [ ] TS interfaces are covered by at least one test asserting the JSON-to-TS mapping against a realistic fixture, not just trivial input

## Notes
Wire contract is pinned by `character`'s `.vibe/decisions/019-wasm-entrypoint-byte-buffer-loading-and-json-contract.md`. `OpenKakutouCharacter.load` never throws and always returns exactly one of `character`/`error`. Note: the JSON currently exposes sprite *metadata* only (group/image/width/height/axis/palette index) — no decoded pixel data. See item 005 for the follow-on blocker this creates.
