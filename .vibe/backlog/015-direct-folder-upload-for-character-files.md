---
status: todo
depends_on: [003]
---
# Direct Folder Upload for Character Files

## Description
Add a third way to load a character alongside the individual 4-file picker/drag-and-drop from item 003 and the single `.zip` archive from item 010: let the user select or drop an entire folder containing the character's `.def`/`.air`/`.sff`/`.cns` files directly, without having to pick or drop each file one by one. Files are matched by extension within the folder (recursing into subfolders as needed) and fed into the same WASM bridge (item 002) used by items 003 and 010. This targets the common case of a character distributed as a plain folder rather than a zip.

## Acceptance Criteria
- [ ] User can select a folder via a directory picker, or drag-and-drop a folder, and have the character load successfully once all four required files are found inside it
- [ ] Files are matched by extension regardless of subfolder depth within the dropped/selected folder
- [ ] A folder missing one or more required files shows a clear error state naming which file is missing, same UX as item 003's missing-file case
- [ ] A folder containing multiple candidate files for the same extension (e.g. two `.def` files) shows a clear error or a disambiguation choice instead of silently picking one

## Notes
Browser support: click-to-browse folder selection uses the non-standard but widely supported `<input webkitdirectory>` attribute; drag-and-drop of a folder requires walking `DataTransferItem.webkitGetAsEntry()` / `FileSystemDirectoryReader` instead of the flat `FileList` used by item 003. Extraction/matching logic should share the same "bytes in → WASM bridge" path items 003 and 010 already established, not duplicate it.
