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
import { renderAnimationTriggers } from "../game-mode/animation-triggers.ts";
import type { CharacterFileInputOptions } from "../input/character-file-input.ts";
import { renderAnimationPlayer } from "../viewer/animation-player.ts";
import { renderCharacteristicsPanel } from "../viewer/characteristics-panel.ts";
import { renderPalettePicker } from "../viewer/palette-picker.ts";
import { renderSpriteBrowser } from "../viewer/sprite-browser.ts";
import type { CharacterData } from "../wasm/types.ts";

const APP_TITLE = "Character Viewer";

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
  toolbar.append(title, characterName);
  shell.appendChild(toolbar);

  const tabs = document.createElement("wuik-tabs");
  tabs.setAttribute("orientation", "vertical");
  tabs.className = "workspace-shell__nav";

  // Order matters: `<wuik-tabs>` selects index 0 by default with no
  // programmatic API to change it (see the ADR above), so Characteristics
  // must be created first to land there on first mount, matching the
  // launch screen -> workspace transition's own requirement.
  const characteristics = createSection(tabs, "Characteristics");
  const palette = createSection(tabs, "Palette");
  const sprites = createSection(tabs, "Sprites");
  const animation = createSection(tabs, "Animation");
  const inGamePreview = createSection(tabs, "In-game preview");

  shell.appendChild(tabs);
  root.appendChild(shell);

  renderCharacteristicsPanel(characteristics.container, character);
  const spriteBrowser = renderSpriteBrowser(
    sprites.container,
    character,
    sffBytes,
    { bridgeOptions: options.bridgeOptions },
  );
  const animationPlayer = renderAnimationPlayer(
    animation.container,
    character,
    sffBytes,
    { bridgeOptions: options.bridgeOptions },
  );
  const animationTriggers = renderAnimationTriggers(
    inGamePreview.container,
    character,
    sffBytes,
    { bridgeOptions: options.bridgeOptions },
  );
  renderPalettePicker(palette.container, character, sffBytes, {
    bridgeOptions: options.bridgeOptions,
    onPaletteChange: (overridePaletteBytes) => {
      spriteBrowser.setPaletteOverride(overridePaletteBytes);
      animationPlayer.setPaletteOverride(overridePaletteBytes);
    },
  });

  // A single observer reacts to whichever panel `<wuik-tabs>` just
  // hid/revealed, regardless of whether the switch came from a click or a
  // keyboard arrow — `hidden` is the only signal the component exposes.
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const panel = mutation.target as HTMLElement;
      if (panel.hidden) {
        if (panel === animation.panel) {
          animationPlayer.pause();
        }
        if (panel === inGamePreview.panel) {
          animationTriggers.pause();
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
}
