import "@openkakutou/web-ui-kit/tokens.css";
import "@openkakutou/web-ui-kit";
import "./style.css";
import type { CharacterFileInputOptions } from "./input/character-file-input.ts";
import { renderLaunchScreen } from "./shell/launch-screen.ts";
import { renderWorkspaceShell } from "./shell/workspace-shell.ts";
import { appVersion } from "./version.ts";

export interface RenderAppOptions {
  /** Forwarded to every screen's own WASM bridge calls; injectable for testing. */
  bridgeOptions?: CharacterFileInputOptions;
}

/**
 * Renders the app into `root`: a full-frame launch screen (backlog item
 * 020) for the very first character load, transitioning once it succeeds
 * into the persistent workspace shell (toolbar + vertical sidebar section
 * list + one section at a time in main) — see
 * .ux/decisions/001-workspace-navigation-model.md and
 * .vibe/decisions/011-workspace-shell-tabs-composition-and-section-switch-detection.md.
 * Reloading the page always starts back at the launch screen; persisting
 * session state across a reload is explicitly out of scope for this item.
 */
export function renderApp(
  root: HTMLElement,
  version: string,
  options: RenderAppOptions = {},
): void {
  renderLaunchScreen(root, {
    onLoaded: (character, sffBytes) => {
      renderWorkspaceShell(root, version, character, sffBytes, {
        bridgeOptions: options.bridgeOptions,
      });
    },
    bridgeOptions: options.bridgeOptions,
  });
}

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  renderApp(app, appVersion);
}
