---
status: todo
---
# Adopt `web-ui-kit` Design System

## Description
This repo has no UI yet beyond a placeholder (`src/main.ts` just writes a version string) — the ideal moment to adopt the org's shared design system (`web-ui-kit`: layout shell, form/input components, canvas/viewport controls, design tokens) before building any real screen, rather than retrofitting it later. See `roadmap`'s `.vibe/decisions/011`.

## Acceptance Criteria
- [ ] `web-ui-kit` added as a dependency, its layout shell used as this app's root frame
- [ ] Design tokens (color/spacing/typography) applied instead of any ad-hoc CSS
- [ ] No existing functionality (WASM bridge, version display) regresses

## Notes
Should land before or alongside item 004 (Characteristics Panel) — the first real screen. Item 003 (Character File Input) also depends on this now, since its file picker/drop-zone is itself real UI (`web-ui-kit`'s own form-input components include a file drop-zone) — landing 003 first would build that ad-hoc, then need retrofitting, exactly what this decision is meant to avoid. Cross-repo dependency: `web-ui-kit` repo must exist with at least its layout shell/tokens published.
