---
id: 001
title: Character inspection workspace
status: designed
date: 2026-09-03
job: "product.md JTBD 1–6: load a character, see its characteristics, browse sprites, play animations, preview palette overrides, and switch to inspecting a different character mid-session — all without the page itself scrolling"
screens: [launch-screen, workspace-shell, characteristics-section, palette-section, sprite-browser-section, animation-player-section, in-game-preview-section, load-character-popup, preferences-popup]
decision: 001
prototype: none
---

# 001 — Character inspection workspace

## Need

A character creator/modder verifying their own work, or a curious browser exploring someone else's character (product.md: both served equally), opens the app to thoroughly inspect a character's construction across an extended session — checking characteristics, sprites, palette and animations, often cross-referencing more than one of these, and sometimes loading a second character to compare. Today every one of the 5 screens is stacked in one scrolling page; this flow replaces that with a fixed-height desktop-application frame: a one-time launch step to load the first character, then a persistent workspace (toolbar + vertical section navigation + one section at a time) that never scrolls at the page level. Success is a session where the user always knows where they are, never loses their place switching sections, and can load a different character without losing the one they already have until the new one actually works.

## Chosen approach

A **launch screen → persistent workspace** split (decision 001, option 1 of 3 considered): the very first character load happens on a dedicated, full-frame screen — the one genuinely sequential "step" in this app, since nothing else exists to show yet. Once a character loads successfully, the app transitions to a workspace: `<wuik-app-shell>` with a toolbar (character name, "Load character…" action, Preferences icon) and a vertical section list in the sidebar slot (extending `<wuik-tabs>` with a vertical orientation — tracked as a `web-ui-kit` backlog item, not built in this task) driving one visible section in main. Loading a *different* character reuses the same file-input widget inside a popup instead of the full-frame launch screen, so the current character and the user's place in the workspace are never torn down until the new one actually validates — directly answering the flows and states experts' shared requirement that a failed or in-progress switch must never clobber a working session. Each section keeps its own selection state (expanded sprite group, selected animation, playback position) when the user navigates away and back; a full character switch resets that state per section, since a sprite or animation index from the old character has no guaranteed meaning against the new one's data.

## Flow

| Step | User does | System shows | Screen |
|---|---|---|---|
| 1 | Opens the app for the first time in the session | Full-frame launch screen: the existing 4-file drop/pick widget, per-slot status (missing/filled/error), in any order/any number of drops | `launch-screen` |
| 2 | Drops or picks the 4 required files | Per-slot status updates live; once all 4 validate, a brief "Character loaded" confirmation | `launch-screen` |
| 3 | (automatic, on success) | Transitions to the workspace: toolbar shows the character's name; sidebar section list becomes enabled; **Characteristics** is the section shown | `workspace-shell` → `characteristics-section` |
| 4 | Clicks a section in the sidebar (Palette, Sprites, Animation, In-game preview) | That section's content replaces the previous one in main; the previous section's own selection state is kept in memory, untouched | `palette-section` / `sprite-browser-section` / `animation-player-section` / `in-game-preview-section` |
| 5 | Returns to a previously visited section | Its expanded groups / selection / playback position are exactly as left; if it was Animation and playback was running, it is now paused at the frame it was on | same section |
| 6 | Clicks the toolbar's "Load character…" action | Preferences-style popup opens over the still-visible, still-usable workspace, containing the same 4-slot file widget, starting empty | `load-character-popup` |
| 7 | Drops/picks a second character's 4 files and they validate | Popup closes; toolbar name updates to the new character; every section resets to its own default (no stale sprite/animation index from the old character); the sidebar's currently selected section stays selected | `workspace-shell` |
| 8 | Drops/picks files that fail validation in step 6/7 | Popup stays open showing the per-slot error; the original character and workspace underneath are completely unaffected | `load-character-popup` |
| 9 | Clicks the toolbar's Preferences icon | Popup opens with at minimum a "beginner mode" toggle (turns on explanatory tooltips for MUGEN/Ikemen vocabulary across every section) | `preferences-popup` |

## Exit & failure paths

- **Abandon mid-flow (step 1–2, launch screen):** partially filled slots stay exactly as dropped; nothing is lost by navigating away from the tab and back (same-session), since there's nowhere else to go until all 4 validate.
- **Abandon mid-flow (step 6–8, load-character popup):** closing the popup (Esc, close control, or backdrop click) without a valid set of 4 files discards only the popup's own in-progress slots; the workspace and its currently loaded character are untouched.
- **Error at step 2/6/7:** the existing per-slot error messaging (missing/conflicting/unreadable/corrupt file) is reused as-is; the user corrects the specific slot named, not the whole batch.
- **Undo / cancel:** no destructive action exists anywhere in this flow (read-only viewer); "switching" a character is the only state-replacing action, and it is guarded so it only takes effect once the replacement fully validates — there is nothing to undo, only a popup to close.

## Acceptance criteria

- [ ] With no character loaded, the browser tab shows the launch screen full-frame, with no page-level scrollbar at any viewport ≥1024px.
- [ ] Loading a character transitions to the workspace and lands on Characteristics, with the sidebar's other sections now enabled.
- [ ] Switching sections preserves each section's own selection/scroll/expanded state; leaving the Animation section while playing pauses it.
- [ ] The in-game-preview section is a real, clickable sidebar entry leading to a "coming soon" screen — never a disabled item with no explanation.
- [ ] Triggering "Load character…" from the toolbar opens a popup without hiding or resetting the currently loaded character underneath.
- [ ] A failed load in that popup leaves the original character and every section's state completely intact.
- [ ] A successful load in that popup replaces the character, resets every section's own selection state, but keeps the currently active sidebar section selected.
- [ ] At no point does the page itself (the `<html>`/`<body>` scroll) scroll — only a section's own internal content area does, exactly as the sprite/state lists already do today.

## Out of scope

- Building the in-game preview mode itself (buttons to trigger animations/special moves live) — only its placeholder entry point and "coming soon" screen are in scope here; the mode's own UX will be a future flow.
- Building the `web-ui-kit` popup/dialog primitive and the vertical-orientation extension to `<wuik-tabs>` — tracked as `web-ui-kit` backlog items per the user's explicit instruction, not implemented as part of this design or its eventual `/ux:implement` pass in this repo.
- Persisting session state (loaded character, active section, preferences) across a full page reload — out of scope; a reload still returns to the launch screen, same as today.
- Any mobile/narrow-specific layout beyond "stays functional" — this flow's acceptance criteria target the desktop-first (≥1024px) case; narrow behavior is noted in screen specs where it matters but isn't the design priority (product.md).
