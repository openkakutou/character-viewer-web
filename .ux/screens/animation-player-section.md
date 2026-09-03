---
slug: animation-player-section
title: Animation player section
flow: 001
status: designed
source: [file(s) implementing it — filled by /ux:implement]
---

# Animation player section

## Purpose

Play back a chosen animation frame by frame, with playback controls, looping, and an optional collision-box overlay.

## Layout

Unchanged content from `animation-player.ts` (controls row + preview stage), hosted as the workspace's main-slot content. Already fits a bounded frame without page scroll (fixed-height stage, controls above it). The new requirement here is behavioral, not visual: playback must auto-pause when the user navigates to a different sidebar section, since content is hidden rather than destroyed (workspace-shell) and a self-rescheduling `setTimeout` chain would otherwise keep decoding frames for a canvas nobody is looking at.

## States

| State | Trigger | What the user sees | Primary action |
|---|---|---|---|
| Success, nothing selected | Character loaded, section selected | Animation picker, no animation chosen yet | Pick an animation |
| Playing | User presses Play | Frames advance per their own timing, frame counter updates | Pause, step, or navigate away |
| Auto-paused (new) | User navigates to another sidebar section while playing | Playback stops exactly at the current frame; no further decode work happens off-screen | Return to this section to resume manually (not automatic — resuming isn't assumed) |
| Paused | User presses Pause, or returns from Auto-paused | Current frame held, controls show paused state | Play, step, or navigate away |
| Re-entered after another section | User returns via sidebar | Selected animation, frame position, loop toggle, and collision-overlay toggle are all exactly as left | Resume playback manually if desired |
| Reset after character switch | `load-character-popup` succeeds | No animation selected — an old animation number has no meaning against new data (states expert requirement) | Pick an animation from the new character |

## Interactions

| Element | Action | Result | Feedback (<100 ms) |
|---|---|---|---|
| (all existing controls) | unchanged | unchanged | unchanged |
| (implicit) | Navigate to a different sidebar section while playing | Playback pauses | Controls reflect paused state next time this section is viewed |

## Content

| Key | Text | Notes |
|---|---|---|
| (all existing content keys) | unchanged | see `src/viewer/animation-player.ts` |
| tooltip.clsn | "Attack (red) and vulnerability (blue) collision boxes for the current frame." | beginner mode only, next to the "Show collision boxes" toggle |

## Accessibility

- **Keyboard order:** unchanged from current implementation, already keyboard-operable.
- **Focus after each action:** switching into this section moves focus to its heading; auto-pause on navigating away doesn't move focus (the user is already moving focus themselves by clicking another section).
- **Announcements:** an auto-pause triggered by navigation doesn't need its own announcement (the user caused it by leaving); returning to a paused animation should make the paused state clear from the controls' own labelling, already true today.
- **Contrast & targets:** unchanged, already AA.
- **Motion:** the collision-box overlay and frame advance are the app's actual subject matter, not decorative motion — unaffected by the "no motion tokens" gap noted elsewhere.
