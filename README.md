# character-viewer-web

A static web page for browsing everything about an [OpenKakutou](https://github.com/openkakutou) (MUGEN/Ikemen GO-compatible) character: sprites, palettes, animations, and full characteristics — so a character's construction can be thoroughly checked. It also has an in-game preview mode, with buttons to trigger animations live and a one-click list of special moves.

<!-- vibe:begin:features -->
This project is in early-stage development. You can already load a character by picking or dragging in its 4 files (`.def`, `.air`, `.sff`, `.cns`), in one go or across several drops — the app reads them, clearly calls out a missing, conflicting, unreadable, or corrupt file, and confirms once the character is loaded. Once loaded, its name, animation count, sprite count, and full list of combat states display automatically, and every sprite in its sheet can be browsed group by group with its actual image shown on selection — decoded only when you pick it, so even a sheet with hundreds of sprites stays fast to browse. Its animations can also be played back: pick one, then play, pause, or step through it frame by frame, with each frame held for its own correct duration and playback able to loop back to the animation's own loop point. An optional overlay shows each frame's attack and vulnerability collision boxes on top of the sprite. You can also see which external palette (`.act`) files the character references and upload one to preview every sprite and animation frame recolored with it — an invalid or wrong-sized file shows a clear error instead of breaking anything, and a reset button returns to the character's own colors. The remaining browsing screens below are not built yet.

Planned:

- An in-game preview mode: trigger animations with buttons, list special moves and execute each with a single click
<!-- vibe:end:features -->

<!-- vibe:begin:install -->
Requires [Node.js](https://nodejs.org/) `^20.19.0` or `>=22.12.0`.

```sh
npm install
```

Verify the install worked by running the test suite:

```sh
npm test
```

To update dependencies to their latest allowed versions:

```sh
npm update
```

Download a specific version of the `character` library's WebAssembly build (needed to load a character):

```sh
npm run wasm:download -- v0.7.1
```
<!-- vibe:end:install -->

<!-- vibe:begin:usage -->
Start a local dev server with hot reload:

```sh
npm run dev
```

Build the static site for production (output in `dist/`):

```sh
npm run build
```

Preview a production build locally:

```sh
npm run preview
```

Run the test suite:

```sh
npm test
```

Run the linter/formatter (auto-fixes issues in place):

```sh
npm run lint
```
<!-- vibe:end:usage -->

<!-- vibe:begin:docs-index -->
- [docs/architecture.md](docs/architecture.md) — how the app is put together: the main modules, how a character's files flow through them, and its WebAssembly dependency.
- [docs/development.md](docs/development.md) — local dev setup notes, including how to fetch the `character` library's WebAssembly build and how the test suite runs without real network access.
- [docs/testing.md](docs/testing.md) — how the test suite is structured, including how it exercises the real WebAssembly module and works around test-environment quirks.
<!-- vibe:end:docs-index -->
