import "@openkakutou/web-ui-kit/tokens.css";
import "@openkakutou/web-ui-kit";
import "./style.css";
import { getI18n, initAppI18n, onLocaleChange } from "./i18n/i18n.ts";
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

/** Applies the resolved locale to `<html lang>` so assistive technology
 * picks the right pronunciation — see
 * .vibe/decisions/019-i18n-integration-approach.md. */
function applyDocumentLang(): void {
  const instance = getI18n();
  const resolved = instance?.resolvedLanguage ?? instance?.language;
  if (resolved) {
    document.documentElement.lang = resolved;
  }
}

/**
 * Real bootstrap: initializes i18n (backlog item 018) and awaits it before
 * the very first `renderApp` call, so a returning user's persisted locale
 * (or their browser's detected one) is already resolved before anything
 * paints — never an English flash. `renderApp` itself stays synchronous so
 * the existing test suite can keep calling it directly without
 * bootstrapping i18n at all.
 */
async function mount(): Promise<void> {
  await initAppI18n();
  applyDocumentLang();
  onLocaleChange(applyDocumentLang);
  const app = document.querySelector<HTMLDivElement>("#app");
  if (app) {
    renderApp(app, appVersion);
  }
}

if (document.readyState === "complete") {
  void mount();
} else {
  window.addEventListener("load", () => void mount(), { once: true });
}
