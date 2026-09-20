# Data models

## CharacterData
The full character graph returned by the WASM bridge (`loadCharacter`), mirroring the `character` Go library's JSON contract field-for-field.

| Field | Type | Notes |
|---|---|---|
| name | string | |
| author | string | from the `.def` `[Info]` section's "author" key; empty when unset |
| animations | Animation[] | |
| sprites | SpriteGroup[] | |
| stateDefs | StateDef[] | |
| palettes | string[] | `.act` file paths referenced by the `.def`'s `[Files]` section — metadata only, this app never has their bytes (see the palette picker, item 006) |
| spriteFile, animationFile, soundFile, commandFile, constantsFile | string | referenced `.sff`/`.air`/`.snd`/`.cmd`/`.cns` file paths from the `.def`'s `[Files]` section — metadata only, exactly as written there; empty when unset |
| stateFiles | string[] | additional state definition (`.st`) file paths beyond `constantsFile`, from the `.def`'s `[Files]` section, in file order |
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
A single sprite's metadata only — no decoded pixel data (that's `SpritePixelResult`, resolved separately and on demand via `resolveSpritePixels`, not part of this shape).

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
| anim | number | 0 means "not set" (defaults to `number`); see `headerExprs` |
| ctrl, faceP2, hitDefPersist, moveHitPersist, hitCountPersist | boolean | |
| powerAdd, juggle, sprPriority | number | |
| headerExprs | Record<string, string> | raw source text of a header field (e.g. `anim`) that held an unevaluated trigger expression instead of a literal value, keyed by lowercase field name; always an object, empty when none did |
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

## CharacterInputResult
The typed outcome of reading a resolved set of folder files and calling the WASM bridge: success, a specific file's read failure, or the WASM bridge's own reported error — never a thrown exception. On success, `sffBytes` is the same raw `.sff` bytes already read (not re-read), threaded through for on-demand sprite pixel decoding (see `SpritePixelResult`).

```ts
{ status: "success"; character: CharacterData; sffBytes: Uint8Array }
| { status: "read-error"; error: FileReadError }
| { status: "bridge-error"; message: string }
```
Defined in: `src/input/character-file-input.ts`

## CharacterFolderLoadResult
The typed outcome of a full folder-based load (item 015): `CharacterInputResult`'s own 3 outcomes plus every earlier stage that can end the attempt first — no `.def` found at all, several `.def` candidates needing a user choice, or a required referenced file not found/ambiguous.

```ts
CharacterInputResult
| { status: "no-files" }
| { status: "no-candidate" }
| { status: "needs-selection"; candidates: GatheredFile[] }
| { status: "reference-not-found"; kind: "air" | "sff" | "cns"; referencedName: string }
| { status: "reference-ambiguous"; kind: "air" | "sff" | "cns"; referencedName: string; candidates: GatheredFile[] }
```
Defined in: `src/input/character-file-input.ts`

## GatheredFile
One file gathered from a folder selection or drop, paired with its path relative to the folder root.

| Field | Type |
|---|---|
| file | File |
| relativePath | string |
Defined in: `src/input/folder-entries.ts`

## DefFileReferences
The 3 sibling filenames a `.def`'s own `[Files]` section references, read by a deliberately minimal local parse ahead of the real WASM load call (item 015) — empty string means the key wasn't set.

| Field | Type |
|---|---|
| spriteFile | string |
| animationFile | string |
| constantsFile | string |
Defined in: `src/input/def-files-section.ts`

## SpritePixelResult
The typed outcome of decoding one sprite's pixels via `resolveSpritePixels` — a discriminated union, never a thrown exception.

```ts
{ ok: true; pixels: Uint8Array; width: number; height: number } | { ok: false; error: string }
```
`pixels` is a flat, row-major, straight-alpha RGBA buffer (`width * height * 4` bytes) — directly usable with `ImageData`.
Defined in: `src/wasm/bridge.ts`

## GifExportResult
The typed outcome of `encodeAnimationGif` (item 014) — a discriminated union, never a thrown exception, same shape as `SpritePixelResult`/`CharacterResult`.

```ts
{ ok: true; bytes: Uint8Array } | { ok: false; error: string }
```
`bytes` is a complete, ready-to-download GIF89a byte stream.
Defined in: `src/export/gif-export.ts`

## GifCanvasLayout
The shared canvas every frame of one exported GIF is composited onto (item 014), computed from sprite metadata alone before any pixel decode — see `.vibe/decisions/015-gif-export-frame-compositing.md`.

| Field | Type | Notes |
|---|---|---|
| width | number | |
| height | number | |
| frameOffsets | (`{x: number; y: number}` \| null)[] | same length/order as the source frames; `null` for a frame with nothing to draw |
Defined in: `src/export/gif-export.ts`

## FileReadError
Identifies which required file failed to be read as bytes, and why.

| Field | Type | Notes |
|---|---|---|
| kind | RequiredFileKind | `"def" \| "air" \| "sff" \| "cns"` |
| fileName | string | |
| message | string | |
Defined in: `src/input/character-file-input.ts`

