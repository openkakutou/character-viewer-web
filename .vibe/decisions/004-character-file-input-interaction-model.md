---
date: 2026-08-09
status: accepted
---
# Character file input: accumulating slots with per-file error attribution, not a one-shot 4-file batch

**Context:** Backlog item 003 asks for a file picker and/or drag-and-drop that gathers a character's 4 required files (`.def`/`.air`/`.sff`/`.cns`) and feeds them to the existing WASM bridge. The bare acceptance criteria only require selecting the 4 files and showing a clear error for a missing or unreadable file. A `vibe:expert-ui-ux` consultation during planning identified that a naive one-shot "must hand over exactly 4 files in a single gesture, one shared error message" design would fail realistic usage: files often arrive from separate drags, and a single generic error message can't attribute a problem to a specific file or let the user fix just that one without redoing everything.

**Decision:**
- Model the input as 4 independent slots (one per required file kind), accumulated across any number of picker/drop gestures — not a single atomic 4-file batch.
- Re-supplying a file for a kind that already has one (e.g. re-dropping a corrected `.sff` after an error) silently replaces that slot; no confirmation prompt.
- Two files of the *same* required kind arriving in the *same* gesture (e.g. two `.def` files dropped together) is treated as a blocking error naming both filenames — neither is silently kept. This is a superset of what the acceptance criteria states (missing file), applied symmetrically to a name conflict.
- Files that don't match any required extension are reported as ignored rather than silently dropped or misassigned.
- Errors (missing kind, duplicate kind, unreadable file, malformed data rejected by the bridge) are attributed to their specific slot where possible, instead of one shared error region that can only show one problem at a time.
- The native file input stays a first-class control (not a fallback affordance next to the drop zone) so the feature is fully usable by keyboard/screen reader, with state changes announced via `aria-live`.
- A dropped directory gets no special-case handling: it naturally falls through the existing "unrecognized extension" or "unreadable file" paths already required by the acceptance criteria, rather than adding bespoke directory-detection logic.

**Reason:** These are refinements of the same interaction, not new features — realistic drag-and-drop usage does not arrive as one perfect 4-file batch, and users need to be able to fix one wrong file without losing the 3 they already got right. Attributing errors per slot and treating same-gesture duplicates as an error (rather than silent last-write-wins) avoids a worse, harder-to-debug failure mode (a plausible-looking but wrong character load) for a small amount of extra work already implied by the per-file error handling the acceptance criteria already requires.

**Rejected alternatives:**
- *Require exactly 4 files in one atomic gesture, reject anything else* — rejected: does not match realistic drag-and-drop behavior (files often come from separate folder windows/drags) and forces the user to restart from scratch after any single mistake.
- *One shared error message region* — rejected: cannot represent two simultaneous distinct problems (e.g. a missing `.cns` and a corrupt `.sff` at once) without one silently overwriting the other.
- *Silently keep the last file when two of the same kind are given* — rejected: the user gave explicit conflicting input; silently discarding half of it risks a wrong-but-successful load whose cause is invisible later.
- *Bespoke directory-drop detection* — rejected: adds complexity for no behavioral gain, since the existing unrecognized-extension/unreadable-file handling already covers it.
</content>
