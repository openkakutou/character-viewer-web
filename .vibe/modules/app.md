# Module: app
**Role:** Application entry point. Registers the `web-ui-kit` custom elements and design tokens (side-effect imports), then delegates all rendering to `modules/shell.md`'s `renderLaunchScreen`/`renderWorkspaceShell` — the launch screen renders first; once it reports a loaded character, the workspace shell replaces it. Forwards the app version and any injectable WASM bridge options through unchanged.
**Files:** `src/main.ts`, `src/version.ts`, `src/style.css`
**Exports:** `appVersion: string`, `renderApp(root: HTMLElement, version: string, options?: RenderAppOptions): void`, `RenderAppOptions`
**Depends on:** `@openkakutou/web-ui-kit` (external — design tokens, plus the `wuik-*` custom element registration `modules/shell.md` relies on), `modules/shell.md` (`renderLaunchScreen`, `renderWorkspaceShell`)
