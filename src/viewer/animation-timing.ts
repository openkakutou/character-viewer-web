// Pure `.air` Animation/Frame timing helpers shared by every screen that
// plays or exports an Animation (the debug Animation Player, item 007; the
// in-game preview and Special Moves list, items 008/009; the GIF export
// pipeline, item 014) — kept in their own dependency-free module rather than
// living inside `animation-player.ts` so a consumer that isn't itself a
// playback screen (`../export/gif-export.ts`) can import them without also
// depending on `animation-player.ts`'s own DOM-rendering code, which in turn
// depends on the export module for its own "Export GIF"/"Export Stand"
// buttons — see .vibe/decisions/015-gif-export-frame-compositing.md.
// Re-exported from `animation-player.ts` so every existing import site keeps
// working unchanged.
import type { Frame } from "../wasm/types.ts";

/** One game tick, in milliseconds — MUGEN/Ikemen GO's standard 60-ticks/second engine rate. */
export const MS_PER_TICK = 1000 / 60;

/**
 * How long (in ticks) a frame should hold before advancing. A non-positive
 * value — including MUGEN's real "-1 = hold forever" convention — is
 * clamped to a minimum 1-tick hold; true infinite-hold semantics are out of
 * scope for this item.
 */
export function effectiveTickDuration(frame: Frame): number {
  return Math.max(frame.time, 1);
}

/**
 * A frame is blank when its sprite reference uses the `.air` "no sprite
 * shown" sentinel — any negative value on `group` and/or `image`, not just
 * the `-1,-1` pair — matching the `character` library's own `IsBlank()`
 * convention.
 */
export function isBlankFrame(frame: Frame): boolean {
  return frame.group < 0 || frame.image < 0;
}
