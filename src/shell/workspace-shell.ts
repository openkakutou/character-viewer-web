// The persistent workspace shell (backlog item 020): toolbar + vertical
// sidebar section list + exactly one section visible at a time in main, with
// no page-level scroll and each section's own state preserved across
// switches. See .ux/screens/workspace-shell.md,
// .ux/decisions/001-workspace-navigation-model.md and
// .vibe/decisions/011-workspace-shell-tabs-composition-and-section-switch-detection.md
// for why the vertical `<wuik-tabs>` unit (tab-list + all four
// `<wuik-tab-panel>` sections) is composed as one piece inside
// `<wuik-app-shell>`'s main slot rather than split across its
// sidebar/main slots, and why a `MutationObserver` on each panel's `hidden`
// attribute (not `<wuik-tabs>`'s own click/keydown handling) drives
// auto-pause and focus-on-switch.
//
// Backlog item 021 (mid-session character switching): the toolbar's "Load
// character…" button opens a `<wuik-dialog>` (`web-ui-kit` item 016)
// hosting the same folder-based `character-file-input-view.ts` widget the
// launch screen uses, rendered fresh every time the dialog opens so a
// cancelled/failed previous attempt never leaks into the next one. Only a
// *successful* load (`onLoaded`) replaces anything — closing the dialog any
// other way (Esc, backdrop, close button) leaves the currently loaded
// character and every section's state completely untouched, since nothing
// outside the dialog is touched until then. A successful load never
// recreates `<wuik-tabs>` itself (which has no public API to reselect a
// specific tab, see decision 011) — it re-invokes each section's own render
// function on its *existing* container, which is what naturally resets that
// section's own state to default while the sidebar's current selection,
// being untouched, stays exactly where it was.
import type { WuikLocaleSwitcherElement } from "@openkakutou/web-ui-kit";
import { renderAnimationTriggers } from "../game-mode/animation-triggers.ts";
import type { AnimationTriggersHandle } from "../game-mode/animation-triggers.ts";
import { renderSpecialMoveList } from "../game-mode/special-move-list.ts";
import type { SpecialMoveListHandle } from "../game-mode/special-move-list.ts";
import { getI18n, onLocaleChange, t } from "../i18n/i18n.ts";
import { renderCharacterFileInput } from "../input/character-file-input-view.ts";
import type { CharacterFileInputOptions } from "../input/character-file-input.ts";
import { renderAnimationPlayer } from "../viewer/animation-player.ts";
import type { AnimationPlayerHandle } from "../viewer/animation-player.ts";
import { renderCharacteristicsPanel } from "../viewer/characteristics-panel.ts";
import { renderPalettePicker } from "../viewer/palette-picker.ts";
import { renderSpriteBrowser } from "../viewer/sprite-browser.ts";
import type { SpriteBrowserHandle } from "../viewer/sprite-browser.ts";
import type { CharacterData } from "../wasm/types.ts";

// The app's own brand name -- a proper noun, deliberately never translated
// (see .vibe/decisions/019-i18n-integration-approach.md).
const APP_TITLE = "Character Viewer";

/** One entry per section, in mount order — pairs each `<wuik-tab-panel>`
 * with the translation key/default driving both its `label` attribute and
 * its rendered tab button's text (see the ADR above for why both need
 * updating on a locale change). */
interface SectionLabel {
  key: string;
  defaultValue: string;
}

const SECTION_LABELS: readonly SectionLabel[] = [
  { key: "shell.section.characteristics", defaultValue: "Characteristics" },
  { key: "shell.section.palette", defaultValue: "Palette" },
  { key: "shell.section.sprites", defaultValue: "Sprites" },
  { key: "shell.section.animation", defaultValue: "Animation" },
  { key: "shell.section.inGamePreview", defaultValue: "In-game preview" },
  { key: "shell.section.specialMoves", defaultValue: "Special Moves" },
];

/**
 * Retranslates every already-mounted section tab in place: `<wuik-tabs>` has
 * no supported API to relabel a tab after its initial `slotchange`-driven
 * build, so this updates each `<wuik-tab-panel>`'s own `label` attribute
 * (the source of truth for any future rebuild) *and* reaches into
 * `<wuik-tabs>`'s shadow DOM to rewrite the already-rendered tab buttons'
 * `textContent` directly by index — only `textContent`, never the button
 * element itself, so `aria-selected` and keyboard focus survive untouched.
 * See .vibe/decisions/019-i18n-integration-approach.md.
 */
function retranslateSectionTabs(
  tabs: HTMLElement,
  panels: readonly HTMLElement[],
): void {
  const tabButtons =
    tabs.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  panels.forEach((panel, index) => {
    const label = t(
      SECTION_LABELS[index].key,
      SECTION_LABELS[index].defaultValue,
    );
    panel.setAttribute("label", label);
    const button = tabButtons?.[index];
    if (button) button.textContent = label;
  });
}

export interface WorkspaceShellOptions {
  /** Forwarded to every section's own WASM bridge calls; injectable for testing. */
  bridgeOptions?: CharacterFileInputOptions;
}

interface Section {
  /** The `<wuik-tab-panel>` itself — what `<wuik-tabs>` toggles `hidden` on. */
  panel: HTMLElement;
  /** The plain container inside `panel` that the section's own render function owns. */
  container: HTMLElement;
}

function createSection(tabs: HTMLElement, label: string): Section {
  const panel = document.createElement("wuik-tab-panel");
  panel.setAttribute("label", label);
  panel.className = "workspace-shell__section";

  const container = document.createElement("div");
  container.className = "workspace-shell__section-content";
  panel.appendChild(container);

  tabs.appendChild(panel);
  return { panel, container };
}

/**
 * Moves focus to a newly visible section's own heading (an `<h1>`–`<h3>`
 * each section already renders), per every section spec's own "Focus after
 * each action" requirement. A heading isn't focusable by default, so a
 * `tabindex="-1"` is added the first time (never removed — the element
 * stays reusable across every future switch back to this section).
 */
function focusSectionHeading(panel: HTMLElement): void {
  const heading = panel.querySelector<HTMLElement>("h1, h2, h3");
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) {
    heading.tabIndex = -1;
  }
  heading.focus();
}

/**
 * `renderWorkspaceShell` is only ever really invoked once per session (once
 * the launch screen hands off), but tests call it repeatedly — torn down at
 * the top of every call, before a fresh one is made, so a locale-change
 * subscription from a previous call never accumulates or fires against
 * content no longer on the page. Mirrors `character-editor`'s own
 * equivalent (`.vibe/decisions/019-i18n-integration-approach.md`).
 */
let currentUnsubscribeLocaleChange: (() => void) | undefined;

/**
 * Renders the workspace shell into `root`, replacing its previous content.
 * `character`/`sffBytes` must already be a successfully loaded character —
 * the shell only ever exists once the launch screen (or, in a future
 * backlog item, the "Load character…" popup) has produced one.
 */
export function renderWorkspaceShell(
  root: HTMLElement,
  version: string,
  character: CharacterData,
  sffBytes: Uint8Array,
  options: WorkspaceShellOptions = {},
): void {
  currentUnsubscribeLocaleChange?.();
  currentUnsubscribeLocaleChange = undefined;
  root.replaceChildren();

  const shell = document.createElement("wuik-app-shell");

  const toolbar = document.createElement("wuik-toolbar");
  toolbar.slot = "toolbar";
  toolbar.setAttribute("role", "banner");
  const title = document.createElement("span");
  title.className = "app-title";
  title.textContent = `${APP_TITLE} — v${version}`;
  const characterName = document.createElement("span");
  characterName.className = "workspace-shell__character-name";
  characterName.textContent = character.name;

  // "Load character…" (backlog item 021): opens a dialog hosting the same
  // folder-input widget the launch screen uses, over the still-visible,
  // still-usable workspace — see the module-level doc comment above.
  const loadCharacterButton = document.createElement("wuik-button");
  loadCharacterButton.className = "workspace-shell__load-character-button";
  loadCharacterButton.setAttribute("variant", "secondary");
  loadCharacterButton.dataset.action = "load-character";
  loadCharacterButton.textContent = t("shell.loadCharacter", "Load character…");

  const loadCharacterDialog = document.createElement("wuik-dialog");
  loadCharacterDialog.className = "workspace-shell__load-character-dialog";

  const loadCharacterHeading = document.createElement("span");
  loadCharacterHeading.slot = "heading";
  loadCharacterHeading.textContent = t(
    "shell.loadCharacterDialog.heading",
    "Load a different character",
  );
  loadCharacterDialog.appendChild(loadCharacterHeading);

  const loadCharacterInputContainer = document.createElement("div");
  loadCharacterDialog.appendChild(loadCharacterInputContainer);

  const localeSwitcher = document.createElement(
    "wuik-locale-switcher",
  ) as unknown as WuikLocaleSwitcherElement;
  localeSwitcher.className = "locale-switcher";
  localeSwitcher.setAttribute("label", t("app.languageLabel", "Language"));
  localeSwitcher.i18n = getI18n();
  toolbar.append(
    title,
    characterName,
    loadCharacterButton,
    loadCharacterDialog,
    localeSwitcher,
  );
  shell.appendChild(toolbar);

  const tabs = document.createElement("wuik-tabs");
  tabs.setAttribute("orientation", "vertical");
  tabs.className = "workspace-shell__nav";

  // Order matters: `<wuik-tabs>` selects index 0 by default with no
  // programmatic API to change it (see the ADR above), so Characteristics
  // must be created first to land there on first mount, matching the
  // launch screen -> workspace transition's own requirement.
  const characteristics = createSection(
    tabs,
    t(SECTION_LABELS[0].key, SECTION_LABELS[0].defaultValue),
  );
  const palette = createSection(
    tabs,
    t(SECTION_LABELS[1].key, SECTION_LABELS[1].defaultValue),
  );
  const sprites = createSection(
    tabs,
    t(SECTION_LABELS[2].key, SECTION_LABELS[2].defaultValue),
  );
  const animation = createSection(
    tabs,
    t(SECTION_LABELS[3].key, SECTION_LABELS[3].defaultValue),
  );
  const inGamePreview = createSection(
    tabs,
    t(SECTION_LABELS[4].key, SECTION_LABELS[4].defaultValue),
  );
  const specialMoves = createSection(
    tabs,
    t(SECTION_LABELS[5].key, SECTION_LABELS[5].defaultValue),
  );

  shell.appendChild(tabs);
  root.appendChild(shell);

  /**
   * The 4 handles a character (re)load produces — kept as one mutable
   * record (backlog item 021) so a later "Load character…" success can
   * `pause()` whichever previous handles exist before discarding them, and
   * so the `MutationObserver` below always reacts against whichever
   * handles are current rather than the ones captured at initial mount.
   */
  interface SectionHandles {
    spriteBrowser: SpriteBrowserHandle;
    animationPlayer: AnimationPlayerHandle;
    animationTriggers: AnimationTriggersHandle;
    specialMoveList: SpecialMoveListHandle;
  }
  let handles: SectionHandles | undefined;
  // Tracks whichever character is currently loaded — updated by
  // `loadCharacterIntoSections` (backlog item 021) — so a later locale
  // change re-renders Characteristics from the *current* character, not the
  // one this function was first called with.
  let currentCharacter = character;

  /**
   * (Re)renders every section's own content into its already-existing
   * container for `character`/`sffBytes`, pausing whichever previous
   * handles exist first (backlog item 021 — a character switch must not
   * leave a self-rescheduling playback timer running against a container
   * about to be replaced). Each section's own render function already
   * tears down and rebuilds its own DOM from scratch (`root.replaceChildren()`
   * at its top), which is what resets that section's own selection/expanded/
   * playback state to default. Never touches `tabs`/the panels themselves,
   * so the sidebar's currently active section stays selected — `<wuik-tabs>`
   * has no public API to reselect a specific tab (decision 011), so simply
   * never re-creating it is what satisfies that requirement.
   */
  function loadCharacterIntoSections(
    nextCharacter: CharacterData,
    nextSffBytes: Uint8Array,
  ): void {
    handles?.animationPlayer.pause();
    handles?.animationTriggers.pause();
    handles?.specialMoveList.pause();

    currentCharacter = nextCharacter;
    characterName.textContent = nextCharacter.name;

    renderCharacteristicsPanel(characteristics.container, nextCharacter);
    const spriteBrowser = renderSpriteBrowser(
      sprites.container,
      nextCharacter,
      nextSffBytes,
      { bridgeOptions: options.bridgeOptions },
    );
    const animationPlayer = renderAnimationPlayer(
      animation.container,
      nextCharacter,
      nextSffBytes,
      { bridgeOptions: options.bridgeOptions },
    );
    const animationTriggers = renderAnimationTriggers(
      inGamePreview.container,
      nextCharacter,
      nextSffBytes,
      { bridgeOptions: options.bridgeOptions },
    );
    const specialMoveList = renderSpecialMoveList(
      specialMoves.container,
      nextCharacter,
      nextSffBytes,
      { bridgeOptions: options.bridgeOptions },
    );
    renderPalettePicker(palette.container, nextCharacter, nextSffBytes, {
      bridgeOptions: options.bridgeOptions,
      onPaletteChange: (overridePaletteBytes) => {
        spriteBrowser.setPaletteOverride(overridePaletteBytes);
        animationPlayer.setPaletteOverride(overridePaletteBytes);
      },
    });

    handles = {
      spriteBrowser,
      animationPlayer,
      animationTriggers,
      specialMoveList,
    };
  }

  loadCharacterIntoSections(character, sffBytes);

  // "Load character…" (backlog item 021): the folder-input widget is
  // rendered fresh every time the dialog opens, so a cancelled or failed
  // previous attempt never leaks into the next one — closing the dialog any
  // other way than a successful load simply discards this container's
  // current content, touching nothing else. Only `onLoaded` (a real success)
  // closes the dialog and switches the workspace.
  //
  // Two guards, both found via UI/UX expert consultation:
  // - A no-op if the dialog is already open, so a repeat click can't render
  //   a second fresh widget instance on top of one already validating.
  // - `onLoaded`'s own check that the dialog is *still* open at the moment
  //   it fires: the folder-read/WASM call it resolves from is async, so a
  //   user who already dismissed the dialog (Esc/backdrop/close button)
  //   before it resolved must not have their workspace silently swapped out
  //   from under them by a late success they no longer asked for.
  loadCharacterButton.addEventListener("click", () => {
    if (loadCharacterDialog.hasAttribute("open")) return;
    renderCharacterFileInput(loadCharacterInputContainer, {
      onLoaded: (nextCharacter, nextSffBytes) => {
        if (!loadCharacterDialog.hasAttribute("open")) return;
        loadCharacterDialog.toggleAttribute("open", false);
        loadCharacterIntoSections(nextCharacter, nextSffBytes);
      },
      bridgeOptions: options.bridgeOptions,
    });
    loadCharacterDialog.toggleAttribute("open", true);
  });

  // A single observer reacts to whichever panel `<wuik-tabs>` just
  // hid/revealed, regardless of whether the switch came from a click or a
  // keyboard arrow — `hidden` is the only signal the component exposes.
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const panel = mutation.target as HTMLElement;
      if (panel.hidden) {
        if (panel === animation.panel) {
          handles?.animationPlayer.pause();
        }
        if (panel === inGamePreview.panel) {
          handles?.animationTriggers.pause();
        }
        if (panel === specialMoves.panel) {
          handles?.specialMoveList.pause();
        }
      } else {
        focusSectionHeading(panel);
      }
    }
  });
  for (const section of [
    characteristics,
    palette,
    sprites,
    animation,
    inGamePreview,
    specialMoves,
  ]) {
    observer.observe(section.panel, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }

  // Characteristics starts selected (never transitions through a `hidden`
  // mutation itself, so the observer above never fires for it on mount) —
  // its own initial focus move is done explicitly here instead.
  focusSectionHeading(characteristics.panel);

  const allPanels = [
    characteristics,
    palette,
    sprites,
    animation,
    inGamePreview,
    specialMoves,
  ].map((section) => section.panel);

  // Live locale switching (backlog item 018): the characteristics panel
  // carries no state of its own, so it's simply re-rendered from the
  // character data already held in this closure; every other section owns
  // live/async state and retranslates its own already-shown text in place
  // via its own internal subscription (see
  // .vibe/decisions/019-i18n-integration-approach.md).
  currentUnsubscribeLocaleChange = onLocaleChange(() => {
    localeSwitcher.setAttribute("label", t("app.languageLabel", "Language"));
    retranslateSectionTabs(tabs, allPanels);
    renderCharacteristicsPanel(characteristics.container, currentCharacter);
    loadCharacterButton.textContent = t(
      "shell.loadCharacter",
      "Load character…",
    );
    loadCharacterHeading.textContent = t(
      "shell.loadCharacterDialog.heading",
      "Load a different character",
    );
  });
}
