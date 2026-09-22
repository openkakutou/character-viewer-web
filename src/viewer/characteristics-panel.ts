// The characteristics panel (backlog item 004): the app's first real
// content screen, proving the full load pipeline (file input → WASM
// bridge → typed data → UI) end to end. Appears inline, automatically,
// right after a character finishes loading — no tab/sidebar navigation
// yet, see .vibe/decisions/005-characteristics-panel-inline-no-tab-navigation-yet.md.
import { t } from "../i18n/i18n.ts";
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

  const trimmedAuthor = character.author.trim();
  const author = trimmedAuthor === "" ? null : document.createElement("p");
  if (author !== null) {
    author.className = "characteristics-panel__author";
    author.textContent = t(
      "characteristicsPanel.authorLabel",
      "Author: {{name}}",
      {
        name: trimmedAuthor,
      },
    );
  }

  const totalSpriteCount = character.sprites.reduce(
    (sum, group) => sum + group.sprites.length,
    0,
  );

  const stats = document.createElement("dl");
  stats.className = "characteristics-panel__stats";
  stats.append(
    buildStat(
      "animations",
      t("characteristicsPanel.animationsLabel", "Animations"),
      character.animations.length,
    ),
    buildStat(
      "sprites",
      t("characteristicsPanel.spritesLabel", "Sprites"),
      totalSpriteCount,
    ),
  );

  const statesSection = document.createElement("section");
  statesSection.className = "characteristics-panel__states";

  const sortedStateNumbers = character.stateDefs
    .map((stateDef) => stateDef.number)
    .sort((a, b) => a - b);

  const heading = document.createElement("h3");
  heading.textContent = t(
    "characteristicsPanel.statesHeading",
    "States ({{count}})",
    {
      count: String(sortedStateNumbers.length),
    },
  );
  statesSection.appendChild(heading);

  if (sortedStateNumbers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "characteristics-panel__states-empty";
    empty.textContent = t(
      "characteristicsPanel.statesEmpty",
      "No Statedefs found.",
    );
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

  const filesSection = buildFilesSection(character);

  panel.append(name);
  if (author !== null) panel.append(author);
  panel.append(stats, statesSection);
  if (filesSection !== null) panel.append(filesSection);
  root.appendChild(panel);
}

/**
 * Builds the "Files" section listing the referenced `.def [Files]` metadata
 * (sprite/animation/sound/command/constants/state files) as labeled,
 * basename-only entries — never the full path (see
 * .vibe/decisions/014-characteristics-panel-full-metadata-scope.md).
 * `palettes` is deliberately not repeated here; it already has its own
 * display in the palette picker. Returns `null` (render nothing) when no
 * field has a value, rather than an empty section.
 */
function buildFilesSection(character: CharacterData): HTMLElement | null {
  const entries: Array<{ label: string; value: string }> = [
    {
      label: t("characteristicsPanel.spriteFileLabel", "Sprite file"),
      value: character.spriteFile,
    },
    {
      label: t("characteristicsPanel.animationFileLabel", "Animation file"),
      value: character.animationFile,
    },
    {
      label: t("characteristicsPanel.soundFileLabel", "Sound file"),
      value: character.soundFile,
    },
    {
      label: t("characteristicsPanel.commandFileLabel", "Command file"),
      value: character.commandFile,
    },
    {
      label: t("characteristicsPanel.constantsFileLabel", "Constants file"),
      value: character.constantsFile,
    },
    ...character.stateFiles.map((value) => ({
      label: t("characteristicsPanel.stateFileLabel", "State file"),
      value,
    })),
  ]
    .map((entry) => ({ label: entry.label, value: basename(entry.value) }))
    .filter((entry) => entry.value !== "");

  if (entries.length === 0) return null;

  const section = document.createElement("section");
  section.className = "characteristics-panel__files";

  const heading = document.createElement("h3");
  heading.textContent = t("characteristicsPanel.filesHeading", "Files");
  section.appendChild(heading);

  const list = document.createElement("dl");
  list.className = "characteristics-panel__files-list";
  for (const entry of entries) {
    list.appendChild(buildFileEntry(entry.label, entry.value));
  }
  section.appendChild(list);

  return section;
}

function buildFileEntry(label: string, value: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "characteristics-panel__files-item";

  const dt = document.createElement("dt");
  dt.textContent = `${label}: `;

  const dd = document.createElement("dd");
  dd.textContent = value;

  wrapper.append(dt, dd);
  return wrapper;
}

/**
 * Returns the final path segment of `path` (splitting on either `/` or
 * `\`), trimmed — never the full path, which could be long or
 * directory-prefixed in a real character's `.def` file. Returns `""` for a
 * blank/whitespace-only or empty path, so an empty metadata field degrades
 * to "nothing to show" rather than an empty string surviving as a
 * displayed, meaningless entry.
 */
function basename(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "") return "";
  const segments = trimmed.split(/[/\\]/).filter((segment) => segment !== "");
  return segments.length === 0 ? "" : segments[segments.length - 1];
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
