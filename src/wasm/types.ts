// Typed mirror of the JSON contract published by the `character` WASM
// module (`OpenKakutouCharacter.load`). Field names and shapes match the
// Go-side `json:"..."` tags exactly — see `character`'s
// .vibe/decisions/019-wasm-entrypoint-byte-buffer-loading-and-json-contract.md.
// These are pure data types: no parsing/decoding logic lives here.

/** A frame's mirroring axis, matching the tokens used in `.air` files. */
export type Flip = "" | "H" | "V" | "HV";

/**
 * A frame's blending mode token as found in `.air` files (e.g. "A" for
 * additive, "S" for subtractive). Empty string means normal blending.
 */
export type BlendMode = string;

/** A `.cns` [Statedef N] block's "type" parameter. */
export type StateType = "S" | "C" | "A" | "L" | "U";

/** A `.cns` [Statedef N] block's "movetype" parameter. */
export type MoveType = "A" | "I" | "H" | "U";

/** A `.cns` [Statedef N] block's "physics" parameter. */
export type PhysicsType = "S" | "C" | "A" | "N" | "U";

/** An axis-aligned collision box (Clsn1/Clsn2 coordinate system). */
export interface ClsnBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A single displayed image within an Animation. */
export interface Frame {
  group: number;
  image: number;
  x: number;
  y: number;
  time: number;
  flip: Flip;
  blend: BlendMode;
  clsn1: ClsnBox[];
  clsn2: ClsnBox[];
}

/** One `.air` `[Begin Action N]` block. */
export interface Animation {
  number: number;
  frames: Frame[];
  loopStart: number;
}

/** One sprite within a `.sff` sprite group. */
export interface Sprite {
  group: number;
  image: number;
  width: number;
  height: number;
  axisX: number;
  axisY: number;
  palette: number;
}

/** A group of sprites sharing the same `.sff` group index. */
export interface SpriteGroup {
  index: number;
  sprites: Sprite[];
}

/** A `.cns` state controller, stored as unevaluated trigger/parameter data. */
export interface Controller {
  type: string;
  triggers: string[];
  parameters: Record<string, string>;
}

/** One `.cns` `[Statedef N]` block plus its controllers. */
export interface StateDef {
  number: number;
  type: StateType;
  moveType: MoveType;
  physics: PhysicsType;
  anim: number;
  ctrl: boolean;
  powerAdd: number;
  juggle: number;
  faceP2: boolean;
  hitDefPersist: boolean;
  moveHitPersist: boolean;
  hitCountPersist: boolean;
  sprPriority: number;
  controllers: Controller[];
}

/** The full character graph returned by `OpenKakutouCharacter.load`. */
export interface CharacterData {
  name: string;
  animations: Animation[];
  sprites: SpriteGroup[];
  stateDefs: StateDef[];
}

/**
 * Result of the typed bridge wrapper: exactly one of `character`/`error` is
 * ever meaningful, mirroring the WASM module's own `{character, error}`
 * contract one level up in TypeScript, as a discriminated union instead of
 * a thrown exception.
 */
export type CharacterResult =
  | { ok: true; character: CharacterData }
  | { ok: false; error: string };
