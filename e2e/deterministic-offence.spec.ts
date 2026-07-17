import { expect, test } from "@playwright/test";

test("Analyzer exposes versioned coverage and withholds unsupported exact DPS", async ({ page }) => {
  await page.goto("/analyze-item");
  await page.getByLabel("Build profile").selectOption("ice-shot-deadeye");
  await page.getByLabel("Item text").fill(`Item Class: Bows
Rarity: Rare
Cold Branch
Dualstring Bow
--------
Physical Damage: 100-200
Cold Damage: 20-40
Critical Hit Chance: 5.00%
Attacks per Second: 1.50`);
  await page.getByRole("button", { name: "Advanced options" }).click();
  await page.getByLabel("Manual listings").fill('[{"id":"e2e","price":10,"currency":"exalted","baseType":"Dualstring Bow","rarity":"rare","stats":{}}]');
  await page.getByRole("button", { name: "Analyze item" }).click();
  const card = page.getByTestId("deterministic-offence");
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("Ice Shot");
  await expect(card).toContainText("Withheld");
  await expect(card).toContainText("verified secondary-hit geometry");
  await expect(card.getByRole("link", { name: /PoE2 Wiki/i })).toHaveAttribute("href", /poe2wiki\.net\/wiki\/Ice_Shot/);
});

test("deterministic offence result remains readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/analyze-item");
  await page.getByLabel("Build profile").selectOption("ice-shot-deadeye");
  await page.getByLabel("Item text").fill("Item Class: Bows\nRarity: Rare\nCold Branch\nDualstring Bow\n--------\nPhysical Damage: 100-200\nAttacks per Second: 1.50");
  await page.getByRole("button", { name: "Advanced options" }).click();
  await page.getByLabel("Manual listings").fill('[{"id":"e2e-mobile","price":10,"currency":"exalted","baseType":"Dualstring Bow","rarity":"rare","stats":{}}]');
  await page.getByRole("button", { name: "Analyze item" }).click();
  const card = page.getByTestId("deterministic-offence");
  await expect(card).toBeVisible({ timeout: 15_000 });
  const overflow = await card.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(overflow).toBe(false);
});
