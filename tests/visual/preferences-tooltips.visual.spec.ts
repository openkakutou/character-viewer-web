import path from "node:path";
import { waitForVisualReady } from "@openkakutou/web-ui-kit/testing/visual-preset";
import { expect, test } from "@playwright/test";

/**
 * Real-browser verification for backlog item 022 (Preferences popup +
 * beginner-mode tooltips) -- reuses the same fixture pack and
 * `loadFixtureCharacter` shape as `character-viewer.visual.spec.ts`.
 */
const characterPackDir = path.resolve(
  import.meta.dirname,
  "fixtures",
  "character-pack",
);

async function loadFixtureCharacter(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/");
  await page.setInputFiles("#character-folder-picker", characterPackDir);
  await expect(page.locator(".characteristics-panel")).toBeVisible();
}

async function switchToSection(
  page: import("@playwright/test").Page,
  label: string,
): Promise<void> {
  await page.getByRole("tab", { name: label }).click();
}

test("Preferences popup toggles beginner-mode tooltips across sections, real browser", async ({
  page,
}) => {
  await loadFixtureCharacter(page);

  const preferencesButton = page.locator('[data-action="preferences"]');
  const dialog = page.locator(".workspace-shell__preferences-dialog");
  const checkbox = dialog.locator('input[type="checkbox"]');

  // 1. Popup opens, off by default. `<wuik-dialog>`'s host has no visible
  // box of its own once open -- its shadow-internal native `<dialog>`
  // escapes to the browser's top layer via `showModal()` -- so visibility
  // is asserted on its slotted content, not the host element itself.
  await preferencesButton.click();
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();
  await page.screenshot({ path: "test-results/022-01-popup-open.png" });

  // 2. Turn it on, close with Escape.
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toHaveAttribute("open", "");
  // Focus returns to the toolbar Preferences icon.
  await expect(preferencesButton).toBeFocused();

  const statesTooltip = page.locator(
    ".characteristics-panel__states .info-tooltip",
  );
  await expect(statesTooltip).toBeVisible();
  await page.screenshot({ path: "test-results/022-02-icons-visible.png" });

  // 3. Hover reveals the bubble, fully inside the viewport.
  const trigger = statesTooltip.locator(".info-tooltip__trigger");
  await trigger.hover();
  const bubble = statesTooltip.locator(".info-tooltip__bubble");
  await expect(bubble).toHaveClass(/info-tooltip__bubble--visible/);
  await expect(bubble).toContainText("A named mode of the character");
  const box = await bubble.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  if (box && viewport) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
  await page.screenshot({ path: "test-results/022-03-tooltip-open.png" });

  await page.mouse.move(0, 0);
  await expect(bubble).not.toHaveClass(/info-tooltip__bubble--visible/);

  // 4. Keyboard focus alone reveals it; Escape dismisses without losing focus.
  await trigger.focus();
  await expect(bubble).toHaveClass(/info-tooltip__bubble--visible/);
  await page.keyboard.press("Escape");
  await expect(bubble).not.toHaveClass(/info-tooltip__bubble--visible/);
  await expect(trigger).toBeFocused();

  // Verify the other three sections' icons too.
  await switchToSection(page, "Palette");
  await expect(
    page.locator(".palette-picker__upload-row .info-tooltip"),
  ).toBeVisible();

  await switchToSection(page, "Sprites");
  await expect(page.locator(".sprite-browser .info-tooltip")).toBeVisible();

  await switchToSection(page, "Animation");
  await expect(
    page
      .locator(".animation-player__collision")
      .locator("..")
      .locator(".info-tooltip"),
  ).toBeVisible();

  // 5. Turn beginner mode back off -- every icon disappears at once.
  await switchToSection(page, "Characteristics");
  await preferencesButton.click();
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
  await page.keyboard.press("Escape");

  await expect(statesTooltip).toBeHidden();
  await switchToSection(page, "Palette");
  await expect(
    page.locator(".palette-picker__upload-row .info-tooltip"),
  ).toBeHidden();
  await switchToSection(page, "Sprites");
  await expect(page.locator(".sprite-browser .info-tooltip")).toBeHidden();
  await switchToSection(page, "Animation");
  await expect(
    page
      .locator(".animation-player__collision")
      .locator("..")
      .locator(".info-tooltip"),
  ).toBeHidden();
  await switchToSection(page, "Characteristics");
  await waitForVisualReady(page);
  await page.screenshot({ path: "test-results/022-04-icons-hidden-again.png" });

  // 6. Turn back on, load a different character (same fixture pack), icons persist.
  await preferencesButton.click();
  await checkbox.click();
  await page.keyboard.press("Escape");

  await page.locator('[data-action="load-character"]').click();
  const loadDialog = page.locator(".workspace-shell__load-character-dialog");
  await loadDialog
    .locator("#character-folder-picker")
    .setInputFiles(characterPackDir);
  await expect(loadDialog).toBeHidden();

  await expect(statesTooltip).toBeVisible();
});
