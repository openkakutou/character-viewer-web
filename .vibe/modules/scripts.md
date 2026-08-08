# Module: scripts

**Role:** Dev-tooling scripts that are not part of the shipped static site — currently, fetching the `character` library's pinned WebAssembly release build into `public/wasm/`, replacing a local Go-toolchain build.
**Files:** `scripts/download-wasm.mjs`
**Exports:** `downloadWasmRelease(options): Promise<string[]>`, `main(argv, overrides): Promise<number>`, `DownloadError`, `EXIT_CODES`
**Depends on:** none (Node built-ins only: `node:fs/promises`, `node:path`, `node:url`, global `fetch`)
