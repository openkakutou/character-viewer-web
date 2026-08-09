# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- Added a script (`npm run wasm:download -- <version>`) to fetch a specific `character` release's WebAssembly build directly, so setting up this project no longer requires a Go toolchain or a local checkout of the `character` repository.
- Added the internal bridge that loads a character's data (name, animations, sprites, combat states) from `.def`/`.air`/`.sff`/`.cns` files via the `character` WebAssembly module, laying the groundwork for the viewer's upcoming screens.
- Adopted the org's shared `web-ui-kit` design system: the app now uses its standard layout frame (toolbar + main content area) and design tokens, so upcoming screens will look and behave consistently with the rest of the OpenKakutou tools.
