---
status: done
---
# WASM Release Download Script

## Description
`character` now publishes a downloadable WebAssembly build (`character.wasm` + `wasm_exec.js`) on every tagged release, starting with `v0.1.0`. Replace the current local-build workaround (checking out `../character` as a sibling and running the Go toolchain) with a script that downloads the pinned release assets for a specific `character` version tag straight into `public/wasm/` (gitignored). Update `CLAUDE.md` and `README.md` to drop the "not yet published" caveat.

## Acceptance Criteria
- [ ] Running the script with a pinned `character` version (e.g. `v0.1.0`) downloads `character.wasm` and `wasm_exec.js` into `public/wasm/`
- [ ] No Go toolchain or sibling `../character` checkout is required anymore to obtain the WASM artifact
- [ ] A wrong/nonexistent version tag fails with a clear error message instead of silently producing an empty or broken file
- [ ] `CLAUDE.md`'s "WASM dependency on `character`" section and `README.md` are updated to reflect the new download-based workflow

## Notes
See `character-viewer-web/CLAUDE.md`'s "WASM dependency on `character`" section (pre-update) and `character`'s `.vibe/backlog/done/033-wasm-entrypoint-and-release-pipeline.md` for the release pipeline this consumes. `public/wasm/` stays gitignored — the artifact is fetched, never committed.
