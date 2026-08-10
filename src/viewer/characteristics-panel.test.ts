import { describe, expect, it } from "vitest";
import type {
  Animation,
  CharacterData,
  SpriteGroup,
  StateDef,
} from "../wasm/types.ts";
import { renderCharacteristicsPanel } from "./characteristics-panel.ts";

function animation(number: number): Animation {
  return { number, frames: [], loopStart: 0 };
}

function spriteGroup(index: number, spriteCount: number): SpriteGroup {
  return {
    index,
    sprites: Array.from({ length: spriteCount }, (_, i) => ({
      group: index,
      image: i,
      width: 1,
      height: 1,
      axisX: 0,
      axisY: 0,
      palette: 0,
    })),
  };
}

function stateDef(number: number): StateDef {
  return {
    number,
    type: "S",
    moveType: "I",
    physics: "S",
    anim: number,
    ctrl: true,
    powerAdd: 0,
    juggle: 0,
    faceP2: false,
    hitDefPersist: false,
    moveHitPersist: false,
    hitCountPersist: false,
    sprPriority: 0,
    controllers: [],
  };
}

function characterWith(overrides: Partial<CharacterData>): CharacterData {
  return {
    name: "Test Character",
    animations: [],
    sprites: [],
    stateDefs: [],
    ...overrides,
  };
}

describe("renderCharacteristicsPanel", () => {
  it("displays the name, animation count, total sprite count, and sorted state numbers for a real character", () => {
    const root = document.createElement("div");
    const character = characterWith({
      name: "Bardock",
      animations: [animation(0), animation(100), animation(200)],
      sprites: [spriteGroup(0, 5), spriteGroup(1, 0), spriteGroup(2, 3)],
      stateDefs: [stateDef(200), stateDef(0), stateDef(52)],
    });

    renderCharacteristicsPanel(root, character);

    expect(root.textContent).toContain("Bardock");
    const animCount = root.querySelector(
      ".characteristics-panel__stat--animations dd",
    );
    expect(animCount?.textContent).toBe("3");
    const spriteCount = root.querySelector(
      ".characteristics-panel__stat--sprites dd",
    );
    // 5 + 0 + 3 = 8 individual sprites across all groups, not 3 groups.
    expect(spriteCount?.textContent).toBe("8");

    const stateItems = Array.from(
      root.querySelectorAll(".characteristics-panel__states-list li"),
    ).map((el) => el.textContent);
    expect(stateItems).toEqual(["0", "52", "200"]);
  });

  it("shows explicit zero counts and an empty-state message for a character with no animations, sprites, or states", () => {
    const root = document.createElement("div");
    const character = characterWith({ name: "Empty Character" });

    renderCharacteristicsPanel(root, character);

    expect(
      root.querySelector(".characteristics-panel__stat--animations dd")
        ?.textContent,
    ).toBe("0");
    expect(
      root.querySelector(".characteristics-panel__stat--sprites dd")
        ?.textContent,
    ).toBe("0");
    expect(
      root.querySelector(".characteristics-panel__states-list"),
    ).toBeNull();
    const emptyMessage = root.querySelector(
      ".characteristics-panel__states-empty",
    );
    expect(emptyMessage?.textContent).toContain("No Statedefs");
  });

  it("stays scannable and complete for a character with a large number of states", () => {
    const root = document.createElement("div");
    const manyStates = Array.from({ length: 150 }, (_, i) => stateDef(i));
    const character = characterWith({ stateDefs: manyStates });

    renderCharacteristicsPanel(root, character);

    const stateItems = root.querySelectorAll(
      ".characteristics-panel__states-list li",
    );
    expect(stateItems).toHaveLength(150);
    const heading = root.querySelector(".characteristics-panel__states h3");
    expect(heading?.textContent).toContain("150");
  });

  it("shows duplicate state numbers as-is rather than silently deduplicating them", () => {
    const root = document.createElement("div");
    const character = characterWith({
      stateDefs: [stateDef(10), stateDef(10), stateDef(5)],
    });

    renderCharacteristicsPanel(root, character);

    const stateItems = Array.from(
      root.querySelectorAll(".characteristics-panel__states-list li"),
    ).map((el) => el.textContent);
    expect(stateItems).toEqual(["5", "10", "10"]);
  });

  it("fully replaces the previous character's data when rendered again for a different character", () => {
    const root = document.createElement("div");
    const first = characterWith({
      name: "Ryu",
      animations: [animation(0)],
      stateDefs: [stateDef(0)],
    });
    const second = characterWith({
      name: "Ken",
      animations: [animation(0), animation(1)],
      stateDefs: [stateDef(1), stateDef(2)],
    });

    renderCharacteristicsPanel(root, first);
    renderCharacteristicsPanel(root, second);

    expect(root.textContent).toContain("Ken");
    expect(root.textContent).not.toContain("Ryu");
    const stateItems = Array.from(
      root.querySelectorAll(".characteristics-panel__states-list li"),
    ).map((el) => el.textContent);
    expect(stateItems).toEqual(["1", "2"]);
  });

  it("renders nothing when no character has been loaded yet", () => {
    const root = document.createElement("div");

    renderCharacteristicsPanel(root, null);

    expect(root.children).toHaveLength(0);
  });
});
