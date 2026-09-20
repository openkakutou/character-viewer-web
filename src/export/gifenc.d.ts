// Minimal ambient types for the `gifenc` package (github.com/mattdesl/gifenc),
// which ships no TypeScript declarations of its own and isn't on
// DefinitelyTyped. Only the surface `gif-export.ts` actually uses is typed
// here — not the full library API.
declare module "gifenc" {
  /** An RGB (`[r, g, b]`) or RGBA (`[r, g, b, a]`) color, 0-255 per channel. */
  export type GifencColor =
    | [number, number, number]
    | [number, number, number, number];

  export interface QuantizeOptions {
    format?: "rgb565" | "rgb444" | "rgba4444";
    oneBitAlpha?: boolean | number;
    clearAlpha?: boolean;
    clearAlphaThreshold?: number;
    clearAlphaColor?: number;
  }

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): GifencColor[];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: readonly GifencColor[],
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): Uint8Array;

  export interface WriteFrameOptions {
    palette?: readonly GifencColor[] | null;
    first?: boolean;
    transparent?: boolean;
    transparentIndex?: number;
    delay?: number;
    repeat?: number;
    dispose?: number;
  }

  export interface GifEncoderInstance {
    writeHeader(): void;
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: WriteFrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
    readonly buffer: ArrayBuffer;
  }

  export function GIFEncoder(options?: {
    auto?: boolean;
    initialCapacity?: number;
  }): GifEncoderInstance;
}
