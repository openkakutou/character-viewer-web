---
status: todo
depends_on: [003]
---
# Zip Archive Character Input

## Description
Add a second way to load a character alongside the individual 4-file picker/drag-and-drop from item 003: let the user select or drop a single `.zip` archive containing the character's `.def`/`.air`/`.sff`/`.cns` files, extracted client-side (no backend) and matched by file extension, then fed into the same WASM bridge (item 002) used by item 003. This is a convenience on top of item 003, not a replacement — many real MUGEN/Ikemen characters are distributed as a single zip.

## Acceptance Criteria
- [ ] User can select or drop a `.zip` file containing the four character files (in any folder depth inside the archive) and have the character load successfully
- [ ] A zip missing one or more required files shows a clear error state naming which file is missing, same UX as item 003's missing-file case
- [ ] A zip containing multiple candidate files for the same extension (e.g. two `.def` files) shows a clear error or a disambiguation choice instead of silently picking one
- [ ] A corrupt/unreadable zip shows a clear error state instead of crashing the page

## Notes
Requires a client-side zip decompression library (static site, no backend). Extraction and matching logic should share the same "bytes in → WASM bridge" path item 003 already established, not duplicate it.
