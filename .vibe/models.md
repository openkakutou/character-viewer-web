# Data models

## CharacterData
The full character graph returned by the WASM bridge (`loadCharacter`), mirroring the `character` Go library's JSON contract field-for-field.

| Field | Type | Notes |
|---|---|---|
| name | string | |
| animations | Animation[] | |
| sprites | SpriteGroup[] | |
| stateDefs | StateDef[] | |
Defined in: `src/wasm/types.ts`

## Animation
One `.air` `[Begin Action N]` block.

| Field | Type | Notes |
|---|---|---|
| number | number | |
| frames | Frame[] | |
| loopStart | number | index into `frames` where playback loops back to |
Defined in: `src/wasm/types.ts`

## Frame
A single displayed image within an Animation.

| Field | Type | Notes |
|---|---|---|
| group, image | number | identifies the Sprite to display |
| x, y | number | |
| time | number | |
| flip | Flip | `"" \| "H" \| "V" \| "HV"` |
| blend | BlendMode | free-form string, e.g. `"A"` (additive) |
| clsn1 | ClsnBox[] | attack boxes, already resolved from any file-level default |
| clsn2 | ClsnBox[] | vulnerability boxes, already resolved from any file-level default |
Defined in: `src/wasm/types.ts`

## ClsnBox
An axis-aligned collision box.

| Field | Type |
|---|---|
| left, top, right, bottom | number |
Defined in: `src/wasm/types.ts`

## SpriteGroup
A collection of Sprites sharing the same `.sff` group index.

| Field | Type |
|---|---|
| index | number |
| sprites | Sprite[] |
Defined in: `src/wasm/types.ts`

## Sprite
A single sprite's metadata (no decoded pixel data — see `character`'s own `034-expose-sprite-pixel-resolution-via-wasm.md`, not yet bridged here).

| Field | Type | Notes |
|---|---|---|
| group, image | number | |
| width, height | number | |
| axisX, axisY | number | pivot point offset |
| palette | number | palette bank index |
Defined in: `src/wasm/types.ts`

## StateDef
One `.cns` `[Statedef N]` block plus its controllers.

| Field | Type | Notes |
|---|---|---|
| number | number | |
| type | StateType | `"S" \| "C" \| "A" \| "L" \| "U"` |
| moveType | MoveType | `"A" \| "I" \| "H" \| "U"` |
| physics | PhysicsType | `"S" \| "C" \| "A" \| "N" \| "U"` |
| anim | number | |
| ctrl, faceP2, hitDefPersist, moveHitPersist, hitCountPersist | boolean | |
| powerAdd, juggle, sprPriority | number | |
| controllers | Controller[] | |
Defined in: `src/wasm/types.ts`

## Controller
A single `.cns` state controller, stored as unevaluated trigger/parameter data (not resolved against MUGEN/Ikemen's expression language).

| Field | Type |
|---|---|
| type | string |
| triggers | string[] |
| parameters | Record<string, string> |
Defined in: `src/wasm/types.ts`

## CharacterResult
The typed outcome of `loadCharacter`: a discriminated union so a failure (malformed input, WASM-reported error) is a typed value, never a thrown exception.

```ts
{ ok: true; character: CharacterData } | { ok: false; error: string }
```
Defined in: `src/wasm/types.ts`
