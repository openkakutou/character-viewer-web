# 023 — Visual regression CI runs in Playwright's own Docker image

## Context

Every `Deploy to GitHub Pages` run since item 019 introduced the visual
regression suite (`692792a`) failed on the `visual` job, on every single
push — not intermittently. All four screenshot comparisons failed with the
same shape of diff: identical height, received width ~9px narrower than
the committed baseline (e.g. 1094×259 expected vs. 1085×259 received).

The `visual` job installed Chromium directly onto the bare `ubuntu-latest`
runner (`npx playwright install --with-deps chromium`). That produced
font-rendering (glyph metrics, hinting, subpixel antialiasing) that never
matched whatever machine originally captured the committed baseline PNGs —
a permanent environment mismatch, not flakiness. No amount of retrying
would have made these pass.

## Decision

The `visual` job now runs inside Playwright's own published Docker image
(`mcr.microsoft.com/playwright`, pinned to the exact `@playwright/test`
version in `package.json`, referenced by digest), which bundles a matching
Chromium build and font set. The "Cache/Install Playwright browsers" steps
are removed — the image already has them.

Baselines are regenerated through the *same* image
(`docker run --rm -v "$PWD:/work" -w /work --ipc=host
mcr.microsoft.com/playwright:v1.62.1-noble bash -c "npm ci && npm run
test:visual:update"`), so a locally-regenerated baseline is guaranteed to
match what CI renders — confirmed by running the full suite twice more
inside the container with no `--update-snapshots`, both green.

## Consequence

Bumping `@playwright/test` in `package.json` must be paired with bumping
the image tag/digest in `.github/workflows/deploy-pages.yml`'s `visual`
job, and every baseline regenerated through the new image before merging —
otherwise the exact same mismatch reappears. See `docs/testing.md` for the
regeneration command.
