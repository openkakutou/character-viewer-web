# Module: wasm

**Role:** Bridge between this app and the `character` WASM module: loads `wasm_exec.js` and instantiates `character.wasm` client-side, and exposes a typed wrapper around the global `OpenKakutouCharacter.load` call — the TypeScript vocabulary (`CharacterData` and its nested shapes) the rest of the app will consume, and the error handling contract (a typed result, never a thrown exception) other UI modules build on.
**Files:** `src/wasm/types.ts`, `src/wasm/bridge.ts`
**Exports:** `loadCharacter(defBytes, airBytes, sffBytes, cnsBytes, options?): Promise<CharacterResult>`, `resetWasmBridgeForTests(): void`, `WasmBridgeOptions`, `CharacterData`, `CharacterResult`, `Animation`, `Frame`, `ClsnBox`, `SpriteGroup`, `Sprite`, `StateDef`, `Controller`, `Flip`, `BlendMode`, `StateType`, `MoveType`, `PhysicsType`
**Depends on:** none (browser `fetch`/`WebAssembly` only)
