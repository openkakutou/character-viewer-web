---
date: 2026-09-06
status: accepted
---
# In-game preview trigger buttons: default continuous loop, click-to-stop toggle

**Context:** Backlog item 008 adds an "In-game preview" section listing every animation as a button; clicking one plays it live in a shared preview stage, reusing item 007's timing/decode/draw building blocks rather than its full debug UI (dropdown, step, manual loop/collision toggles).

**Decision:** A triggered animation loops continuously by default (no opt-in "Loop" checkbox, unlike the debug Animation tab) until another animation is triggered or the section is navigated away from. Clicking the *currently playing* animation's own button again stops it in place (freezing the last frame) instead of restarting it or being a no-op; its button's `aria-pressed` reverts to `false` and a persistent "now playing" label reflects the stopped state.

**Reason:** Continuous looping best matches how an idle/walk/etc. animation actually behaves inside a real match, which is the entire point of an "in-game" preview (checking combat feel, not just data). But that default removes every other panel's pause affordance, so with no way to freeze a frame the section would read as broken rather than intentional to a returning user. Reusing the trigger button itself as a stop toggle gives that affordance back for free — no new control, no extra chrome — while keeping "one click, immediate playback" the only interaction model the acceptance criteria asks for.

**Rejected alternatives:** Adding a separate Play/Pause control (rejected: duplicates the debug Animation tab's own controls, which this section deliberately avoids to stay "in-game" rather than "inspector"). Playing once through and stopping by default, like the debug tab's own default (rejected: doesn't match real in-game looping behavior, which is the feature's whole reason to exist).
