---
status: todo
depends_on: [003]
---
# Direct Folder Upload for Character Files

## Description
Add a third way to load a character alongside the individual 4-file picker/drag-and-drop from item 003 and the single `.zip` archive from item 010: let the user select or drop an entire folder containing the character's `.def`/`.air`/`.sff`/`.cns` files, without having to pick or drop each file one by one. The `.def` file is the entry point: it is identified within the folder first (prompting for disambiguation if the folder holds more than one candidate), then parsed to read which `.air`/`.sff`/`.cns` filenames it actually references — those specific files are located within the folder by that name (recursing into subfolders as needed), not guessed by extension alone. A folder can otherwise contain more than one file of a given extension (e.g. leftover/alternate `.sff`s) without those being mistaken for the ones the character actually uses. The resolved bytes are fed into the same WASM bridge (item 002) used by items 003 and 010. This targets the common case of a character distributed as a plain folder rather than a zip.

## Acceptance Criteria
- [ ] If the folder contains exactly one `.def` file, it is used automatically as the entry point
- [ ] If the folder contains multiple `.def` files, the user is prompted to pick which one to load, instead of the app silently choosing one
- [ ] The `.air`/`.sff`/`.cns` files are located by the filename the chosen `.def` actually references (searching subfolder depth as needed), not by matching "any file with this extension"
- [ ] A file the `.def` references but that cannot be found anywhere in the folder shows a clear error state naming which referenced file is missing, same UX as item 003's missing-file case

## Notes
Browser support: click-to-browse folder selection uses the non-standard but widely supported `<input webkitdirectory>` attribute; drag-and-drop of a folder requires walking `DataTransferItem.webkitGetAsEntry()` / `FileSystemDirectoryReader` instead of the flat `FileList` used by item 003. Reading which filenames the `.def` references requires parsing its `[Files]`-equivalent section — check whether the WASM bridge (item 002) already exposes this, or whether a minimal local text parse of just that section is needed ahead of the full "bytes in → WASM bridge" load call items 003 and 010 established; either way, don't duplicate `character`'s own `.def` parser logic here. Open question to resolve during implementation, not before.
