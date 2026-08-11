---
date: 2026-08-11
status: accepted
---
# Raw `.sff` bytes are threaded through the load result, not re-read

**Context:** The sprite browser (item 005) needs to decode a selected sprite's actual pixels on demand, via the `character` WASM module's separate `resolveSprites(sffBytes, requests, overrideBytes)` call — deliberately not part of `OpenKakutouCharacter.load`'s JSON contract, which only ever carries sprite metadata (group, image, width, height, axis, palette index), never pixel data. `resolveSprites` needs the original `.sff` file bytes again, but `loadCharacterFromSlots`'s existing success result only ever returned the parsed `CharacterData`, discarding the raw bytes it read from each `File` after handing them to `loadCharacter`.

**Decision:** `CharacterInputResult`'s `"success"` variant, and the `onLoaded` callback it feeds (`character-file-input-view.ts` → `main.ts`), now also carry the raw `sffBytes: Uint8Array` alongside the parsed `character: CharacterData` — the same bytes already read from the user's `.sff` file selection, not re-read or re-fetched. `main.ts` passes them straight through to the new sprite browser panel.

**Reason:** The alternative — re-reading the `.sff` `File` object again from the sprite browser — would require plumbing the original `File` (not just its already-read bytes) an extra layer deeper for no benefit, and re-reads bytes already sitting in memory. Threading the bytes already read once, at the one place they're read, is the smaller change and matches the file input module's own existing "read once, pass forward" flow for the other three file kinds (which are also read once and never re-read).

**Rejected alternatives:**
- **Re-read the `.sff` `File` from the sprite browser via a stored reference**: rejected — needs the `File` object itself to survive past the initial load (a wider surface than one `Uint8Array`), and reads the same bytes twice for no reason.
- **Cache decoded pixels for every sprite eagerly at load time**: rejected outright by the acceptance criteria themselves — a sheet can hold hundreds of sprites, and decoding is explicitly on-demand, one selection at a time (see decision 007).
