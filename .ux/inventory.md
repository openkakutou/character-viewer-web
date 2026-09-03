# UI inventory — character-viewer-web

> Written by `/ux:discover`, refreshed by `/ux:implement`. Describes the UI as it *is*, not as it should be.

## UI stack

- **Framework / UI layer:** none — plain TypeScript + native DOM (`document.createElement`), Web Components from `@openkakutou/web-ui-kit` mounted directly
- **Component library / design system:** `@openkakutou/web-ui-kit` (org-wide shared kit, published to npm, pinned `^0.3.0`)
- **Styling approach:** custom CSS (`src/style.css`) reading `web-ui-kit` CSS custom-property tokens exclusively — no literal px/hex values, no CSS framework
- **UI state management:** none — each screen is a pure `render*(root, data, options)` function called once per data change; cross-screen state (palette override) passed via a returned handle (`{ setPaletteOverride }`), not a shared store
- **Routing / navigation:** none — single page, no router; screens are DOM containers appended to `<main>` in a fixed order, revealed by calling their render function once a character loads
- **i18n:** none wired into this app (English-only); `web-ui-kit` has an i18n layer (English/French) but this app doesn't use it yet
- **UI testing:** Vitest + jsdom (unit-level, DOM assertions); real-browser verification via Playwright for effects jsdom can't exercise (canvas 2D context) — see `docs/testing.md`

## Design tokens

All from `@openkakutou/web-ui-kit`, imported once via `tokens.css`; theme switch is `data-theme="dark"` on an ancestor element (no `prefers-color-scheme` fallback by design).

| Token family | Source file | Values / scale |
|---|---|---|
| Colors | `web-ui-kit/src/tokens/colors.css` | Semantic pairs, light + dark: `--wuik-color-bg`, `-surface`, `-border`, `-text`, `-text-secondary`, `-accent`, `-text-on-accent`, `-danger`, `-text-on-danger`, `-success`, `-warning`, `-focus-ring`. All text/background pairs verified WCAG AA; `-danger` is not verified as text and is never used for text. |
| Typography | `web-ui-kit/src/tokens/typography.css` | `--wuik-font-family-base` (system-ui stack), `-mono`; sizes `xs`/`sm`/`base`/`lg`/`xl`; weights `regular`/`medium`/`bold`; line-heights `tight`/`base` |
| Spacing | `web-ui-kit/src/tokens/spacing.css` | `--wuik-space-0`…`8`, 4px base unit (0 → 4rem) |
| Radii / borders | inline in component CSS (e.g. `border-radius: var(--wuik-space-2)`) | no dedicated radius scale — spacing tokens reused for radius |
| Breakpoints | none found | no documented breakpoint tokens; narrow-viewport behavior (see `app-shell-empty-narrow.png` capture) relies on flex-wrap, not media queries |
| Motion | none found | no motion/duration/easing tokens in the kit yet |
| Theming (dark mode…) | `colors.css`, `color-scheme` property | `data-theme="dark"` on any ancestor; `color-scheme` set so native chrome (native `<select>` dropdown, scrollbars) matches |

## Screens / views

All five appear inline, stacked top-to-bottom in one scrolling page, inside a single `<wuik-app-shell>` (toolbar slot only — no sidebar, no tabs used despite being available in the kit). Nothing is routed; screens 2–5 are hidden until a character loads, then all render at once.

| Screen | Entry point | Source | Purpose | Capture |
|---|---|---|---|---|
| App shell (empty) | page load | `src/main.ts` | Toolbar with app title + version; hosts every other screen in `<main>` | `.ux/captures/audit-2026-09-03/app-shell-empty-light.png`, `-dark.png`, `-narrow.png` |
| Character file input | always visible at top | `src/input/character-file-input-view.ts` | Pick/drag the 4 required files (`.def`/`.air`/`.sff`/`.cns`) across any number of drops; per-slot status (missing/filled/error); loads the character via the WASM bridge on completion | included in `loaded-character-full.png` |
| Characteristics panel | auto-appears once loaded | `src/viewer/characteristics-panel.ts` | Name, animation/sprite counts, sorted Statedef list | `loaded-character-full.png` |
| Palette picker | auto-appears once loaded | `src/viewer/palette-picker.ts` | Lists referenced `.act` file names; upload an override `.act` applied to every sprite/frame; reset to the character's own palette | `loaded-character-full.png` |
| Sprite browser | auto-appears once loaded | `src/viewer/sprite-browser.ts` | Collapsed-by-default group list; on-demand decoded pixel preview in a scale-to-fit `<canvas>`; stale-decode discarding on fast re-selection | `sprite-browser-selected.png` |
| Animation player | auto-appears once loaded | `src/viewer/animation-player.ts` | Pick an animation; play/pause/step/loop; per-frame timed playback via self-rescheduling `setTimeout`; optional collision-box overlay | `animation-player-state.png` |

## Reusable components

| Component | Source | Used for | States / variants supported |
|---|---|---|---|
| `<wuik-app-shell>` | `web-ui-kit/src/components/app-shell.ts` | Root frame (toolbar + main); sidebar slot exists but unused here | Collapses empty named slots to zero size, no reserved gutter |
| `<wuik-toolbar>` | `web-ui-kit/src/components/toolbar.ts` | App title bar | — |
| `<wuik-panel>` | `web-ui-kit/src/components/panel.ts` | Wraps every one of the 4 content screens (file input, characteristics, palette, sprites, animation) | Titled panel via `slot="header"` |
| `<wuik-button>` | `web-ui-kit/src/components/button.ts` | Only the palette picker's "reset" button; every other button in the app is a native `<button>` styled with local CSS classes | `variant` (primary/secondary/danger, unrecognized → primary), `disabled`; visible empty-state indicator (⚠) if mounted with no accessible label |
| `<wuik-tabs>` / `<wuik-tab-panel>` | `web-ui-kit/src/components/tabs.ts` | **Not used anywhere in this app** — available, keyboard-accessible tab strip, but every screen renders inline instead (deliberate, see `.vibe/decisions/005` and `008`, revisited each time a new screen landed) | Roving-tab keyboard nav, `aria-selected`, no external programmatic tab-select API yet |
| `<wuik-file-drop-zone>` | `web-ui-kit/src/components/file-drop-zone.ts` | **Not used** — the character file input reimplements drag/drop + a native `<input type="file">` itself instead of using this component | Keyboard-operable, `accept` filtering with a visible rejected state, `aria-live` status |
| `<wuik-slider>` | `web-ui-kit/src/components/slider.ts` | **Not used anywhere** | Live value readout, visible invalid-range indicator |
| `<wuik-color-picker>` | `web-ui-kit/src/components/color-picker.ts` | **Not used anywhere** (the palette picker uploads a raw `.act` file, doesn't pick an RGB color) | Optional preset swatch palette, visible invalid-value indicator |
| `<wuik-viewport>` | `web-ui-kit/src/canvas/viewport.ts` | **Not used** — sprite browser and animation player both use a plain `<canvas>` with a local scale-to-fit instead; deliberate at the time (`.vibe/decisions/007`: not actually installable yet), worth re-checking now | Wheel-zoom, drag-pan, reset-to-fit, fully keyboard-operable |
| `<wuik-viewport-3d>` | `web-ui-kit/src/canvas3d/viewport-3d.ts` | Not applicable — this app is 2D sprite/animation only | — |
| Dialog / modal / popup | — | **Does not exist anywhere in `web-ui-kit`** — no primitive for a popup, overlay, or preferences surface | n/a |

## Interaction patterns in use

- Destructive/irreversible actions: none in this app (read-only viewer, no save/delete)
- Errors shown inline, per-slot or per-panel, in `--wuik-color-text` (not `--wuik-color-danger`, which fails contrast as text) — never a toast, banner, or dialog
- A long list (sprite groups, Statedef list) stays capped-height with internal `overflow-y: auto` rather than growing the page
- Sprite/animation pixel data is decoded only on selection (never eagerly for a whole sheet), with a monotonic token discarding stale/superseded decodes from fast repeated selection
- Cross-screen reaction (palette override affecting the sprite browser and animation player) goes through a small returned handle re-running the affected screen's own "show current selection" entry point — not a shared store or full re-render

## Known gaps

- **Whole-page scroll**: no screen scrolls internally except the sprite/state lists; once a character loads, the 5 stacked panels overflow the viewport and the *page itself* scrolls — this is the redesign's primary target
- **No navigation structure**: `<wuik-tabs>` and the app shell's `sidebar` slot exist in the kit but are unused; every screen is permanently inline, so nothing can be hidden, stepped through, or brought forward
- **No popup/dialog/preferences primitive anywhere in `web-ui-kit`** — a "preferences" surface or any modal/popup the design calls for has no existing component to reuse; this is new ground for the kit, not just for this app
- **Native form controls instead of the kit's own**: file input/drop reimplemented ad hoc instead of `<wuik-file-drop-zone>`; native `<button>`/`<select>`/checkboxes throughout instead of `<wuik-button>` and kit form components — visually plain (default browser chrome) despite token-based *layout* CSS around them
- **No multi-character session support**: loading a second character requires no visible reset/switch action — the file input has no "load another character" affordance today, even though a prolonged multi-character session is a stated goal
- **No breakpoint or motion tokens**: narrow-viewport behavior relies on ad hoc `flex-wrap`, not a documented breakpoint system; no transition/animation tokens exist for any state change (panel reveal, tab switch, etc.)
- **No i18n wired in**: all UI copy is hardcoded English strings, despite the kit having a ready i18n layer
