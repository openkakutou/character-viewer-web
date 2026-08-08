# character-viewer-web

A static web page for browsing everything about an [OpenKakutou](https://github.com/openkakutou) (MUGEN/Ikemen GO-compatible) character: sprites, palettes, animations, and full characteristics — so a character's construction can be thoroughly checked. It also has an in-game preview mode, with buttons to trigger animations live and a one-click list of special moves.

<!-- vibe:begin:features -->
This project is in early-stage development — only the project scaffold exists so far, no viewer functionality yet.

Planned:

- Browse every sprite in a character's sprite sheet
- Choose and preview a color palette
- View a character's full characteristics
- Play back a character's animations
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
No additional documentation yet.
<!-- vibe:end:docs-index -->
