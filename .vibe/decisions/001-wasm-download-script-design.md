---
date: 2026-08-08
status: accepted
---
# WASM download script: direct release URLs, combined not-found exit code, all-or-nothing rollback

**Context:** Backlog item 001 replaces the local Go-toolchain build workaround with a script that downloads `character`'s published WASM release assets (`character.wasm` + `wasm_exec.js`) for a pinned version tag into `public/wasm/`.

**Decision:**
1. Download assets from GitHub's public release *download* URLs (`github.com/<repo>/releases/download/<tag>/<asset>`), never the REST API (`api.github.com/repos/.../releases/tags/<tag>`).
2. A missing/nonexistent tag and an existing tag missing one of the two assets both surface as the same "not found" error/exit code, rather than two distinct codes.
3. If either asset fails to download, any asset already downloaded successfully *in that same run* is rolled back (deleted) — the script never leaves `public/wasm/` with only one of the two files freshly updated.
4. No automatic retry on transient network failures.

**Reason:**
1. Release download URLs are served by GitHub's CDN with no meaningful rate limit for anonymous requests; the REST API shares a 60 requests/hour unauthenticated quota that a CI runner on a shared IP can exhaust.
2. GitHub returns an identical 404 for both cases at the download-URL level. Telling them apart would require an extra REST API call per invocation — reintroducing the exact rate-limit exposure point 1 avoids, for a distinction whose main value (CI auto-retry vs. alert-on-drift) doesn't apply yet since nothing consumes this script from CI today.
3. The two assets form one logical unit (a matched WASM build + its JS glue); a half-updated pair is worse than the old state, and is exactly the "empty or broken file" failure mode the backlog item calls out.
4. Usage is occasional and mostly manual (local dev setup, not a hot CI path yet); a clear immediate failure is preferable to added complexity for a scenario that isn't exercised often. Revisit if this script becomes a routine CI dependency.

**Rejected alternatives:**
- Querying the REST API first to classify "tag not found" vs. "asset missing" into separate exit codes — rejected per reason 2.
- Leaving a successfully-downloaded asset in place when its sibling fails — rejected per reason 3, it would silently mix two different builds.
- Adding 1–2 automatic retries on network failure — rejected for now per reason 4; not a permanent rejection, just out of scope until real usage shows it's needed.
