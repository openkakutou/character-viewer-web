# Module: app
**Role:** Application entry point — builds the app's root frame (the org's shared `web-ui-kit` layout shell) and mounts it into the DOM, with the character file input (module `input`) as the main content and all three `viewer` screens (characteristics panel, sprite browser, animation player) wired to its load callback, passing through the raw `.sff` bytes the sprite browser and animation player both need alongside the parsed character.
**Files:** `src/main.ts`, `src/version.ts`, `src/style.css`
**Exports:** `appVersion: string`, `renderApp(root: HTMLElement, version: string, options?: RenderAppOptions): void`, `RenderAppOptions`
**Depends on:** `@openkakutou/web-ui-kit` (external — layout shell components `wuik-app-shell`/`wuik-toolbar` and design tokens), `modules/input.md` (`renderCharacterFileInput`), `modules/viewer.md` (`renderCharacteristicsPanel`, `renderSpriteBrowser`, `renderAnimationPlayer`)
