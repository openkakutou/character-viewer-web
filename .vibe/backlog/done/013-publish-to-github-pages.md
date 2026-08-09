---
status: done
---
# Publish to GitHub Pages

## Description
This is a static site (no backend) with no hosting story today — nothing here is reachable at a URL. Add a GitHub Actions workflow, triggered on push to `main`, that runs the test/lint gate, downloads the pinned `character` WASM release (`npm run wasm:download`), builds (`npm run build`), and publishes `dist/` to GitHub Pages, so the app is reachable at `https://openkakutou.github.io/character-viewer-web/`. See the roadmap's `.vibe/decisions/015` for the org-wide per-repo GitHub Pages convention this follows.

## Acceptance Criteria
- [ ] A workflow triggered on push to `main` runs `npm test` and `npm run lint` first; a failure stops the workflow before anything is published
- [ ] `npm run wasm:download` fetches the pinned `character` WASM release before the build step, matching this repo's existing local dev convention
- [ ] `npm run build`'s `dist/` output is published to GitHub Pages (via the repo's `gh-pages` branch or the native Pages deployment action)
- [ ] The deployed site loads and runs without a console error caused by an incorrect asset base path (this repo's `vite.config.ts` already sets `base: "./"`, which should already work unmodified for a project-page URL — confirm rather than assume)
- [ ] GitHub Actions steps that touch repo/Pages permissions are pinned to a commit SHA (with a version comment), matching this org's existing CI convention (see `web-ui-kit`'s workflows)

## Notes
No hard dependency on other backlog items — this is infrastructure, not a feature, and can land whenever; deploying early means every later feature lands live automatically on its own next merge, rather than saving up a "first deploy" milestone.
