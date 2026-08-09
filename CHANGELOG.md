# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [0.3.0] - 2026-08-09

### Added

- Users can now load a character by selecting its 4 files (`.def`, `.air`, `.sff`, `.cns`) through a file picker or by dragging and dropping them, in any number of gestures. Missing, conflicting (two files of the same type), unreadable, or corrupt files are called out clearly, and the app automatically loads and confirms the character once all 4 are valid.

## [0.2.0] - 2026-08-09

### Added

- Added a script (`npm run wasm:download -- <version>`) to fetch a specific `character` release's WebAssembly build directly, so setting up this project no longer requires a Go toolchain or a local checkout of the `character` repository.
- Added the internal bridge that loads a character's data (name, animations, sprites, combat states) from `.def`/`.air`/`.sff`/`.cns` files via the `character` WebAssembly module, laying the groundwork for the viewer's upcoming screens.
- Adopted the org's shared `web-ui-kit` design system: the app now uses its standard layout frame (toolbar + main content area) and design tokens, so upcoming screens will look and behave consistently with the rest of the OpenKakutou tools.

[Unreleased]: https://github.com/openkakutou/character-viewer-web/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/openkakutou/character-viewer-web/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/openkakutou/character-viewer-web/releases/tag/v0.2.0
