# Module: app
**Role:** Application entry point — builds the app's root frame (the org's shared `web-ui-kit` layout shell) and mounts it into the DOM, with the character file input (module `input`) as the main content.
**Files:** `src/main.ts`, `src/version.ts`, `src/style.css`
**Exports:** `appVersion: string`, `renderApp(root: HTMLElement, version: string): void`
**Depends on:** `@openkakutou/web-ui-kit` (external — layout shell components `wuik-app-shell`/`wuik-toolbar` and design tokens), `modules/input.md` (`renderCharacterFileInput`)
