import { renderCharacterFileInput } from "../input/character-file-input-view.ts";
// The launch screen (backlog item 020): the app's one genuinely sequential
// "step" — loading the very first character of the session. Full-frame, no
// toolbar/sidebar chrome (there's nothing to navigate to yet), reusing the
// existing 4-file input widget exactly as it already behaves. See
// .ux/screens/launch-screen.md and
// .ux/decisions/001-workspace-navigation-model.md.
import type { CharacterFileInputOptions } from "../input/character-file-input.ts";
import type { CharacterData } from "../wasm/types.ts";

export interface LaunchScreenOptions {
  /** Called once the 4 required files have validated and the character has loaded. */
  onLoaded: (character: CharacterData, sffBytes: Uint8Array) => void;
  /** Forwarded to the file input's WASM bridge; injectable for testing. */
  bridgeOptions?: CharacterFileInputOptions;
}

/**
 * Renders the launch screen into `root`, replacing its previous content.
 * `root` itself is expected to fill the viewport (the height chain is
 * established once, in `style.css`) — this function only supplies the
 * centered frame and the reused file input widget inside it.
 */
export function renderLaunchScreen(
  root: HTMLElement,
  options: LaunchScreenOptions,
): void {
  root.replaceChildren();

  const frame = document.createElement("div");
  frame.className = "launch-screen";

  renderCharacterFileInput(frame, {
    onLoaded: options.onLoaded,
    bridgeOptions: options.bridgeOptions,
  });

  root.appendChild(frame);
}
