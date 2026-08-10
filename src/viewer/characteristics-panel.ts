// The characteristics panel (backlog item 004): the app's first real
// content screen, proving the full load pipeline (file input → WASM
// bridge → typed data → UI) end to end. Appears inline, automatically,
// right after a character finishes loading — no tab/sidebar navigation
// yet, see .vibe/decisions/005-characteristics-panel-inline-no-tab-navigation-yet.md.
import type { CharacterData } from "../wasm/types.ts";

/**
 * Renders the characteristics panel into `root`, replacing its previous
 * content. `character === null` (nothing loaded yet) renders nothing.
 * Calling this again with a different character fully replaces the
 * previous one's data — no stale values remain.
 */
export function renderCharacteristicsPanel(
  root: HTMLElement,
  character: CharacterData | null,
): void {
  root.replaceChildren();
  if (character === null) return;

  const panel = document.createElement("wuik-panel");
  panel.className = "characteristics-panel";

  const name = document.createElement("h2");
  name.className = "characteristics-panel__name";
  name.textContent = character.name;

  const totalSpriteCount = character.sprites.reduce(
    (sum, group) => sum + group.sprites.length,
    0,
  );

  const stats = document.createElement("dl");
  stats.className = "characteristics-panel__stats";
  stats.append(
    buildStat("animations", "Animations", character.animations.length),
    buildStat("sprites", "Sprites", totalSpriteCount),
  );

  const statesSection = document.createElement("section");
  statesSection.className = "characteristics-panel__states";

  const sortedStateNumbers = character.stateDefs
    .map((stateDef) => stateDef.number)
    .sort((a, b) => a - b);

  const heading = document.createElement("h3");
  heading.textContent = `States (${sortedStateNumbers.length})`;
  statesSection.appendChild(heading);

  if (sortedStateNumbers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "characteristics-panel__states-empty";
    empty.textContent = "No Statedefs found.";
    statesSection.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.className = "characteristics-panel__states-list";
    for (const number of sortedStateNumbers) {
      const item = document.createElement("li");
      item.textContent = String(number);
      list.appendChild(item);
    }
    statesSection.appendChild(list);
  }

  panel.append(name, stats, statesSection);
  root.appendChild(panel);
}

function buildStat(
  modifier: string,
  label: string,
  value: number,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = `characteristics-panel__stat characteristics-panel__stat--${modifier}`;

  const dt = document.createElement("dt");
  dt.textContent = label;

  const dd = document.createElement("dd");
  dd.textContent = String(value);

  wrapper.append(dt, dd);
  return wrapper;
}
