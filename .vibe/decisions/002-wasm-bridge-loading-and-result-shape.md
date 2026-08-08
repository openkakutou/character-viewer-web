---
date: 2026-08-08
status: accepted
---
# WASM bridge loads via injectable fetch + `Function` execution, returns a discriminated-union result

**Context:** Item 002 adds `src/wasm/`, the bridge between this app and the `character` WASM module (`OpenKakutouCharacter.load`, per `character`'s `.vibe/decisions/019-wasm-entrypoint-byte-buffer-loading-and-json-contract.md`). The bridge must work both in a real browser (production/dev) and in the Vitest/jsdom test environment, without a running HTTP server backing `public/wasm/` during tests — and per this repo's testing conventions, malformed/missing WASM output must degrade to a typed error, never a thrown exception or a silent crash.

**Decision:**
- The two effects needed to bring the Go runtime up — fetching `wasm_exec.js`'s source text and fetching `character.wasm`'s bytes — are injected as parameters (`fetchWasmExecSource`/`fetchWasmBytes`, defaulting to `fetch()` against `public/wasm/`), the same "inject external effects for testability" pattern `scripts/download-wasm.mjs` already uses (see `.vibe/index.md`). Tests inject a `node:fs`-backed stub instead of running a real server.
- `wasm_exec.js`'s source text is executed via `new Function(source)()` rather than a `<script>` tag or dynamic `import()`. It works identically in a browser and under jsdom/Node because the script explicitly assigns `globalThis.Go = class {...}` itself — it never relies on script-tag/module top-level scoping — so invoking its source as a function body is sufficient and avoids needing a real DOM `<script>` element (unavailable the same way in both environments) or a servable module URL (unavailable under jsdom without a running dev server).
- Once `globalThis.Go` exists, the bridge mirrors `character`'s own `cmd/wasm/smoke.mjs` verification harness exactly: instantiate the `.wasm` bytes, call `go.run(instance)` **without awaiting it**, then call `globalThis.OpenKakutouCharacter.load(...)` synchronously right after. `go.run` only suspends (via the Go scheduler's `select{}` in `main`) after `main()`'s synchronous body — which registers `OpenKakutouCharacter` — has already run; awaiting `go.run` would hang forever since `main` never returns.
- Instantiation is memoized (module-level, resettable) so repeated calls to the wrapper don't re-fetch or re-instantiate the module.
- The wrapper's result type is a discriminated union — `{ ok: true, character: CharacterData } | { ok: false, error: string }` — rather than a thrown exception, mirroring the Go-side contract's own "never throws, exactly one field populated" shape one level up in TypeScript, and matching this repo's testing convention that malformed WASM output must degrade to a clear typed error state.

**Reason:** Keeps the bridge equally testable in jsdom and correct in a real browser without special-casing either environment in the bridge's own logic — only the injected fetch effects differ. Reusing the exact `go.run` non-await sequencing `character`'s own smoke harness already validated avoids re-deriving Go/WASM startup timing from scratch.

**Rejected alternatives:**
- Loading `wasm_exec.js` via a `<script>` tag appended to `document` — rejected: works in a real browser but not under jsdom without a running server to fetch from, and would need a separate code path for tests.
- Awaiting `go.run(instance)` before calling `OpenKakutouCharacter.load` — rejected: `main()` never returns (it blocks forever in `select{}` to keep the Go runtime alive), so the returned promise never resolves.
- Throwing on a WASM-reported error instead of a discriminated-union result — rejected: contradicts this repo's stated convention that malformed/partial WASM output must degrade to a clear UI error state, not a thrown exception.
