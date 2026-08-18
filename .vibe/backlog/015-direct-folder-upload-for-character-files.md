---
status: todo
depends_on: [003]
---
# Folder Selection as the Sole Character File Input Method

## Description
Folder selection becomes the **only** way to load a character on this web app, replacing the individual 4-file picker/drag-and-drop from item 003 outright: the user selects or drops a folder containing the character's `.def`/`.air`/`.sff`/`.cns` files. The `.def` file is the entry point: if the folder contains exactly one, it's used automatically; if it contains more than one, the user is prompted to pick which one to load. Once a `.def` is chosen, it's parsed to read which `.air`/`.sff`/`.cns` filenames it actually references, and those specific files are located within the already-gathered folder listing by that name — not guessed by extension alone, so a folder holding more than one file of a given extension (leftover/alternate assets) isn't mistaken for the ones the character actually uses. The resolved bytes feed the same WASM bridge (item 002) item 003 already established.

This is a static site with no backend and no planned desktop build for this app (unlike the sibling `*-editor` apps — see Notes), so this is the final, single input model for the whole project, not an interim option alongside others.

## Acceptance Criteria
- [ ] The character file input is folder selection only — item 003's standalone multi-file picker/drop zone is removed, not kept alongside this
- [ ] If the folder contains exactly one `.def` file, it is used automatically as the entry point
- [ ] If the folder contains multiple `.def` files, the user is prompted to pick which one to load, instead of the app silently choosing one
- [ ] The `.air`/`.sff`/`.cns` files are located by the filename the chosen `.def` actually references (searching subfolder depth as needed), not by matching "any file with this extension"
- [ ] A file the `.def` references but that cannot be found anywhere in the folder shows a clear error state naming which referenced file is missing, same UX as item 003's missing-file case

## Notes
Item 003 stays `status: done` as the historical record of the original implementation; this item's first acceptance criterion explicitly calls for removing that UI once folder selection lands, not leaving both. Item 010 (zip-archive input) has been dropped from the backlog entirely — a single web input path was chosen over maintaining three (individual files / zip / folder).

Web platform constraint driving this design: picking a single file never grants access to sibling files — neither `<input type="file">` nor the File System Access API's `FileSystemFileHandle` exposes a parent directory, by deliberate browser sandboxing. "Just pick the `.def`, the app finds the rest" cannot work on the web without an explicit folder-level permission grant; folder selection is the only way to reach that UX here. (This constraint is specific to the browser — it would not apply to a native desktop app, but this project has no desktop build planned, unlike `character-editor`/`stage-editor`/`lifebar-editor`.)

Browser support: `<input webkitdirectory>` (Chrome/Firefox/Safari) with `webkitRelativePath` per `File`, or `DataTransferItem.webkitGetAsEntry()` + `FileSystemDirectoryReader.readEntries()` for drag-and-drop — both yield the full folder listing up front, so resolving referenced filenames is a synchronous lookup against an already-built name→bytes table, not an async per-file search. Reading which filenames the `.def` references requires parsing its `[Files]`-equivalent section — check whether the WASM bridge (item 002) already exposes this, or whether a minimal local text parse of just that section is needed ahead of the full "bytes in → WASM bridge" load call item 002 established; either way, don't duplicate `character`'s own `.def` parser logic here. Open question to resolve during implementation, not before.
