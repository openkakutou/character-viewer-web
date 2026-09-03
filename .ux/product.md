# Product — character-viewer-web

> Written by `/ux:discover`. Edit freely — re-run `/ux:discover` to refresh.
> Add `<!-- keep -->` on a section heading to preserve it on refresh.

## What it is

A static web page for thoroughly inspecting the construction of an OpenKakutou (MUGEN/Ikemen GO-compatible) fighting-game character: its full sprite sheet, palette, characteristics (name, animation/sprite counts, combat states), and animations, played back frame by frame. Runs entirely client-side (no backend) as a Vite-built static site, reading `.def`/`.air`/`.sff`/`.cns` files through a WebAssembly module built from the sibling `character` Go library. A planned but unbuilt "in-game preview" mode (trigger animations and special moves live) is documented as future scope.

## Platform & surface

- **Platform:** web (static site, no backend)
- **Devices & input:** desktop-first — mouse + keyboard, wide viewport (≥ ~1024px) is the primary design target; a narrow/mobile layout must stay functional as a safety net but is not the optimization priority
- **Runs with:** `npm run dev` (Vite dev server); requires `npm run wasm:download -- <version>` first to fetch the `character` WASM build into `public/wasm/`

## Users

| Role | Expertise | Frequency of use | Context of use | Main goal |
|---|---|---|---|---|
| Character creator/modder | Expert in MUGEN/Ikemen file formats (already owns/edits the 4 source files) | Iterative, during active work on a character | Extended session, back-and-forth between sprites/palette/animations while refining a character; switches between several characters in the same session | Verify the character is built correctly — catch missing sprites, wrong collision boxes, broken animations, palette mismatches |
| Curious browser | Owns character files (obtained elsewhere) but not necessarily a modder — variable familiarity with MUGEN vocabulary | Occasional, exploratory | Extended session, same back-and-forth as above, may load several characters | Understand how a character someone else made is put together |

Both roles are served equally; neither is a secondary/edge persona. Both already possess a character's raw files before opening the app — there is no built-in library or upload-from-community-source flow.

## Jobs to be done

1. When a character's files are ready to inspect, the user wants to load all 4 (`.def`/`.air`/`.sff`/`.cns`) in one or more drops/picks, so that the app confirms the character loaded correctly or clearly names what's wrong.
2. When a character is loaded, the user wants to see its name, animation/sprite counts, and full state list at a glance, so that they can judge its overall shape before drilling in.
3. When inspecting construction detail, the user wants to browse every sprite group by group with an on-demand decoded preview, so that even a sheet with hundreds of sprites stays fast to look through.
4. When checking motion, the user wants to play, pause, step, and loop any animation frame by frame — optionally with a collision-box overlay — so that timing and hitboxes can be verified visually.
5. When colors matter, the user wants to see which `.act` palette files a character references and preview an uploaded override applied to every sprite/frame, so that recoloring can be checked without needing the original `.act` bytes.
6. When a session runs long, the user wants to switch to inspecting a different character without reloading the page, so that comparing or checking several files in a row doesn't reset their place.
7. (Planned, not yet built) When verifying a character's actual game behavior, the user wants to trigger animations and special moves live in an in-game preview, so that combat feel can be checked, not just static data.

## Constraints

- **Brand / design system:** `@openkakutou/web-ui-kit` — the org-wide shared design system for every OpenKakutou viewer/editor/mode app; components and tokens must be reused, not duplicated, ad hoc
- **Accessibility target:** the baseline `web-ui-kit` already guarantees (full keyboard operability, always-visible focus indicator, WCAG AA text contrast) — no stricter requirement stated for this project
- **Localization:** none in this app yet (English-only UI copy per this project's `CLAUDE.md`); `web-ui-kit` itself has an i18n layer (English/French) used by its own shortcut panel, not yet wired into this app
- **Performance / offline / other:** static site only — no backend, ever (explicit constraint in `CLAUDE.md`); sprite/animation-frame decoding is on-demand, not eager, so hundred-plus-sprite sheets stay responsive
- **Known org-wide feedback:** the current UI across this and sibling viewer/editor apps has been judged unattractive and hard to use (tracked as `web-ui-kit` backlog item 012); this redesign is the first to act on it for this app

## Vocabulary

Mirrored from `.vibe/glossary.md` — specs and UI copy use these words as-is (kept technical/native per this redesign's clarification; explanatory tooltips are opt-in via a preference, not a vocabulary change):

- **Character** — the in-memory representation of a MUGEN/Ikemen GO character (name, animations, sprites, states), loaded from raw file bytes via the WASM bridge.
- **Animation** — an ordered sequence of Frames plus the point where playback loops back.
- **Frame** — a single displayed image within an Animation: which Sprite to show, position, hold duration, mirror/blend mode, and active collision boxes. Can be blank (no Sprite shown).
- **Collision box** — an axis-aligned box on a Frame: an attack box (`clsn1`) or a vulnerability box (`clsn2`).
- **Sprite** — a single image (group + image index, size, pivot offset, palette bank index) a Frame can display.
- **Sprite group** — a collection of Sprites sharing the same group index.
- **Palette override** — an uploaded external `.act` file's 256-color table, applied uniformly in place of each Sprite's own embedded palette; the app never has the bytes of a character's own referenced `.act` files, only their names.
- **State** — a named mode of character behavior (standing, an attack, a hit reaction): a number, its type/move-type/physics classification, and its State controllers.
- **State controller** — a single behavior a State performs, kept as unevaluated data (triggers/parameters verbatim).
