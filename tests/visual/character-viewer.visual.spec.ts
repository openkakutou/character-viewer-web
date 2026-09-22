import path from "node:path";
import { waitForVisualReady } from "@openkakutou/web-ui-kit/testing/visual-preset";
import { expect, test } from "@playwright/test";

/**
 * Visual-regression baselines for this app's three real rendered surfaces
 * (backlog item 019) -- the sprite browser's decoded sprite preview, the
 * animation player's collision-box (Clsn) overlay on and off, and the
 * palette picker's live-recolored preview -- all driven through the app's
 * real folder-picker input against a vendored fixture pack, never a blank
 * or default state. See
 * .vibe/decisions/020-visual-regression-fixture-pairs-def-with-existing-wasm-testdata.md
 * for why the fixture pairs a hand-authored `.def` with this repo's own
 * existing, already WASM-verified `.sff`/`.air`/`.cns` fixtures instead of a
 * separately-authored sprite/animation set.
 */

// A real folder (character.def + byte-for-byte copies of this repo's own
// existing real src/wasm/testdata fixtures) uploaded via Playwright's
// directory-upload support, since the real app only accepts a folder
// through its `<input webkitdirectory>` picker.
const characterPackDir = path.resolve(
  import.meta.dirname,
  "fixtures",
  "character-pack",
);

// A real, valid 768-byte external palette, already vendored elsewhere in
// this org (`character`'s and `sff`'s own WASM testdata) for the same
// "external .act override" purpose -- reused here rather than authoring a
// second one. Confirmed once (see this item's own development notes) to
// visibly recolor the fixture sprite: applying it to character.sff's
// sprite (0,0) changes 3204 of its 5871 pixels' RGB.
const overridePaletteFile = path.resolve(
  import.meta.dirname,
  "fixtures",
  "cyclops-v1-palette1.act",
);

/**
 * Loads the fixture character through the real folder picker and waits for
 * the workspace shell to mount. The shell always lands on the
 * Characteristics section first (`workspace-shell.ts`'s own convention, no
 * programmatic way to change it) -- every other section stays `hidden`
 * until a test explicitly switches to it via `switchToSection`.
 */
async function loadFixtureCharacter(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/");
  await page.setInputFiles("#character-folder-picker", characterPackDir);
  await expect(page.locator(".characteristics-panel")).toBeVisible();
}

/** Switches to the sidebar section labelled `label` (`<wuik-tabs>` has no supported id-based API -- driven by its rendered tab button text, same as a real user would). */
async function switchToSection(
  page: import("@playwright/test").Page,
  label: string,
): Promise<void> {
  await page.getByRole("tab", { name: label }).click();
}

test.describe("sprite browser", () => {
  test("matches its baseline after expanding a group and decoding a real sprite", async ({
    page,
  }) => {
    await loadFixtureCharacter(page);
    await switchToSection(page, "Sprites");

    const group = page.locator(".sprite-browser__group").first();
    await group.locator(".sprite-browser__group-toggle").click();
    // The fixture pack's one sprite (group 0, image 0) -- the only row in
    // this expanded group.
    await group.locator(".sprite-browser__sprite").first().click();

    const preview = page.locator(".sprite-browser__preview");
    await expect(preview.locator(".sprite-browser__canvas")).toBeVisible();

    await waitForVisualReady(page);
    await expect(preview).toHaveScreenshot("sprite-browser-decoded-sprite.png");
  });
});

test.describe("animation player", () => {
  test("matches its baseline on the loaded frame without the collision overlay", async ({
    page,
  }) => {
    await loadFixtureCharacter(page);
    await switchToSection(page, "Animation");

    const stage = page.locator(".animation-player__stage");
    await expect(stage.locator(".animation-player__canvas")).toBeVisible();

    await waitForVisualReady(page);
    await expect(stage).toHaveScreenshot("animation-player-no-clsn.png");
  });

  test("matches its baseline on the same frame with the collision overlay on", async ({
    page,
  }) => {
    await loadFixtureCharacter(page);
    await switchToSection(page, "Animation");

    const stage = page.locator(".animation-player__stage");
    await expect(stage.locator(".animation-player__canvas")).toBeVisible();

    // "click", not "check": the component itself reads .checked from a
    // "click" listener (jsdom-era workaround, but the real click event
    // fires the same way in a real browser) -- see docs/testing.md.
    await page.locator(".animation-player__collision").click();

    await waitForVisualReady(page);
    await expect(stage).toHaveScreenshot("animation-player-with-clsn.png");
  });
});

test.describe("palette picker", () => {
  test("recolors the sprite browser's preview live after applying a real .act override", async ({
    page,
  }) => {
    await loadFixtureCharacter(page);
    await switchToSection(page, "Sprites");

    const group = page.locator(".sprite-browser__group").first();
    await group.locator(".sprite-browser__group-toggle").click();
    await group.locator(".sprite-browser__sprite").first().click();
    const preview = page.locator(".sprite-browser__preview");
    await expect(preview.locator(".sprite-browser__canvas")).toBeVisible();

    await switchToSection(page, "Palette");
    await page
      .locator(".palette-picker__upload-input")
      .setInputFiles(overridePaletteFile);
    await expect(page.locator(".palette-picker__status")).toContainText(
      "cyclops-v1-palette1.act",
    );

    // Back to the sprite browser: setPaletteOverride re-resolves the
    // already-selected sprite in place, so the same preview now shows the
    // recolored pixels.
    await switchToSection(page, "Sprites");
    await expect(preview.locator(".sprite-browser__canvas")).toBeVisible();

    await waitForVisualReady(page);
    await expect(preview).toHaveScreenshot(
      "sprite-browser-recolored-preview.png",
    );
  });
});
