import "@openkakutou/web-ui-kit/tokens.css";
import "@openkakutou/web-ui-kit";
import "./style.css";
import { renderCharacterFileInput } from "./input/character-file-input-view.ts";
import type { CharacterFileInputOptions } from "./input/character-file-input.ts";
import { appVersion } from "./version.ts";
import { renderAnimationPlayer } from "./viewer/animation-player.ts";
import { renderCharacteristicsPanel } from "./viewer/characteristics-panel.ts";
import { renderPalettePicker } from "./viewer/palette-picker.ts";
import { renderSpriteBrowser } from "./viewer/sprite-browser.ts";

const APP_TITLE = "Character Viewer";

export interface RenderAppOptions {
  /** Forwarded to the file input's WASM bridge; injectable for testing. */
  bridgeOptions?: CharacterFileInputOptions;
}

/**
 * Builds the app's root frame — a `web-ui-kit` `<wuik-app-shell>` with the
 * app title (plus version) in the toolbar, the character file input
 * (backlog item 003), and the characteristics panel (backlog item 004), the
 * sprite browser (backlog item 005), and the animation player (backlog item
 * 007) as the main content, all appearing automatically once a character
 * loads — see
 * .vibe/decisions/005-characteristics-panel-inline-no-tab-navigation-yet.md.
 * No sidebar/tabs are slotted yet: `<wuik-app-shell>` collapses empty named
 * slots to zero size with no reserved gutter, so omitting them renders
 * nothing broken — see .vibe/decisions/003-app-shell-adoption-scope.md.
 */
export function renderApp(
  root: HTMLElement,
  version: string,
  options: RenderAppOptions = {},
): void {
  root.replaceChildren();

  const shell = document.createElement("wuik-app-shell");

  const toolbar = document.createElement("wuik-toolbar");
  toolbar.slot = "toolbar";
  toolbar.setAttribute("role", "banner");
  const title = document.createElement("span");
  title.className = "app-title";
  title.textContent = `${APP_TITLE} — v${version}`;
  toolbar.appendChild(title);
  shell.appendChild(toolbar);

  const main = document.createElement("main");
  const characteristicsContainer = document.createElement("div");
  const palettePickerContainer = document.createElement("div");
  const spriteBrowserContainer = document.createElement("div");
  const animationPlayerContainer = document.createElement("div");
  renderCharacterFileInput(main, {
    onLoaded: (character, sffBytes) => {
      renderCharacteristicsPanel(characteristicsContainer, character);
      const spriteBrowser = renderSpriteBrowser(
        spriteBrowserContainer,
        character,
        sffBytes,
        { bridgeOptions: options.bridgeOptions },
      );
      const animationPlayer = renderAnimationPlayer(
        animationPlayerContainer,
        character,
        sffBytes,
        { bridgeOptions: options.bridgeOptions },
      );
      renderPalettePicker(palettePickerContainer, character, sffBytes, {
        bridgeOptions: options.bridgeOptions,
        onPaletteChange: (overridePaletteBytes) => {
          spriteBrowser.setPaletteOverride(overridePaletteBytes);
          animationPlayer.setPaletteOverride(overridePaletteBytes);
        },
      });
    },
    bridgeOptions: options.bridgeOptions,
  });
  main.append(
    characteristicsContainer,
    palettePickerContainer,
    spriteBrowserContainer,
    animationPlayerContainer,
  );
  shell.appendChild(main);

  root.appendChild(shell);
}

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  renderApp(app, appVersion);
}
