// The "Beginner mode" toggle rendered inside the Preferences popup (backlog
// item 022): a plain checkbox+label pair -- the same pattern already used
// for the animation player's "Loop"/"Show collision boxes" toggles -- since
// no dedicated switch component exists yet in `web-ui-kit`. See
// .vibe/decisions/022-beginner-mode-tooltip-widget-and-placement.md.
import { onLocaleChange, t } from "../i18n/i18n.ts";
import {
  isBeginnerMode,
  onBeginnerModeChange,
  setBeginnerMode,
} from "./preferences.ts";

/**
 * `renderBeginnerModeToggle` is only ever really invoked once per session,
 * but tests call it repeatedly -- torn down at the top of every call,
 * before a fresh one is made, so a locale-change/beginner-mode subscription
 * from a previous call never accumulates or fires against content no
 * longer on the page. See .vibe/decisions/019-i18n-integration-approach.md.
 */
let currentUnsubscribeLocaleChange: (() => void) | undefined;
let currentUnsubscribeBeginnerModeChange: (() => void) | undefined;

/**
 * Renders the "Beginner mode" checkbox+label+hint into `root`, replacing
 * its previous content. Starts checked/unchecked to match the current
 * session-wide state, stays in sync with any later change made elsewhere
 * (defensive -- today the only such change is this very checkbox), and
 * flips the shared state immediately on click.
 */
export function renderBeginnerModeToggle(root: HTMLElement): void {
  currentUnsubscribeLocaleChange?.();
  currentUnsubscribeLocaleChange = undefined;
  currentUnsubscribeBeginnerModeChange?.();
  currentUnsubscribeBeginnerModeChange = undefined;
  root.replaceChildren();

  const wrapper = document.createElement("div");
  wrapper.className = "preferences-popup__toggle";

  const id = `beginner-mode-${Math.random().toString(36).slice(2)}`;
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = id;
  checkbox.checked = isBeginnerMode();

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = t("preferences.beginnerModeLabel", "Beginner mode");

  const hint = document.createElement("p");
  hint.className = "preferences-popup__hint";
  hint.textContent = t(
    "preferences.beginnerModeHint",
    "Show explanations for MUGEN/Ikemen terms across the app.",
  );

  wrapper.append(checkbox, label, hint);
  root.appendChild(wrapper);

  // "click" rather than "change": .click() in this project's jsdom test
  // environment does not reliably synthesize a "change" event for a
  // checkbox, while "click"'s default action (toggling .checked) has
  // already run by the time this listener fires -- same convention as
  // animation-player.ts's own toggles.
  checkbox.addEventListener("click", () => {
    setBeginnerMode(checkbox.checked);
  });

  currentUnsubscribeBeginnerModeChange = onBeginnerModeChange(() => {
    checkbox.checked = isBeginnerMode();
  });

  currentUnsubscribeLocaleChange = onLocaleChange(() => {
    label.textContent = t("preferences.beginnerModeLabel", "Beginner mode");
    hint.textContent = t(
      "preferences.beginnerModeHint",
      "Show explanations for MUGEN/Ikemen terms across the app.",
    );
  });
}
