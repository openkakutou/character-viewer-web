import "@openkakutou/web-ui-kit/tokens.css";
import "@openkakutou/web-ui-kit";
import "./style.css";
import { appVersion } from "./version.ts";

const APP_TITLE = "Character Viewer";

/**
 * Builds the app's root frame — a `web-ui-kit` `<wuik-app-shell>` with the
 * app title in the toolbar and the (still placeholder) version string as
 * the main content. No sidebar/tabs are slotted yet: `<wuik-app-shell>`
 * collapses empty named slots to zero size with no reserved gutter, so
 * omitting them renders nothing broken — see
 * .vibe/decisions/003-app-shell-adoption-scope.md.
 */
export function renderApp(root: HTMLElement, version: string): void {
  root.replaceChildren();

  const shell = document.createElement("wuik-app-shell");

  const toolbar = document.createElement("wuik-toolbar");
  toolbar.slot = "toolbar";
  toolbar.setAttribute("role", "banner");
  const title = document.createElement("span");
  title.className = "app-title";
  title.textContent = APP_TITLE;
  toolbar.appendChild(title);
  shell.appendChild(toolbar);

  const main = document.createElement("main");
  main.className = "app-version";
  main.textContent = `${APP_TITLE} — v${version}`;
  shell.appendChild(main);

  root.appendChild(shell);
}

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  renderApp(app, appVersion);
}
