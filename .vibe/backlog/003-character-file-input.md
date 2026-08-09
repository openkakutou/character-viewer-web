---
status: todo
depends_on: [002, 011]
---
# Character File Input

## Description
Since this is a static site with no backend, the user must supply a character's four files (`.def`, `.air`, `.sff`, `.cns`) directly from their machine. Add a file input (standard multi-file picker and/or drag-and-drop) that lets the user select or drop the four files, reads each as a byte buffer, and feeds them into the WASM bridge (item 002).

## Acceptance Criteria
- [ ] User can select the four files via a file picker, or drag-and-drop them onto a drop zone
- [ ] Selected files are read as byte buffers and passed to the WASM bridge's load call
- [ ] A missing required file (e.g. only 3 of 4 provided) shows a clear error state naming which file is missing, instead of calling the bridge with incomplete data
- [ ] An unreadable/corrupt file selection shows a clear error state instead of crashing the page

## Notes
Decision (confirmed with product owner): files are selected individually — no folder picker or zip upload in this first pass.
