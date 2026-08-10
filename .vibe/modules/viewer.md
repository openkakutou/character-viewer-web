# Module: viewer
**Role:** Screens that display an already-loaded character's data. Currently one screen: the characteristics panel — name, animation count, total sprite count (individual sprites summed across all sprite groups), and the sorted list of Statedef numbers — rendered inline, automatically, as soon as a character loads; no tab/sidebar navigation yet (see `.vibe/decisions/005-characteristics-panel-inline-no-tab-navigation-yet.md`). Duplicate Statedef numbers are shown as-is, not deduplicated.
**Files:** `src/viewer/characteristics-panel.ts`
**Exports:** `renderCharacteristicsPanel(root: HTMLElement, character: CharacterData | null): void`
**Depends on:** `modules/wasm.md` (`CharacterData`)
