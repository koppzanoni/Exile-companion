import { describe, expect, it } from "vitest";
import { diagnoseBuild } from "./buildDoctor.js";
import { genericBuildFitProfile } from "./buildProfiles.js";

const ring =
  "Item Class: Rings\nRarity: Rare\nEmber Loop\nGold Ring\n--------\nRequires: Level 60, 38 Dex\n--------\n+30 Dexterity\n+20% to Fire Resistance";
const weaponNeedsDex =
  "Item Class: Bows\nRarity: Rare\nWind String\nComposite Bow\n--------\nRequires: Level 65, 120 Dex\n--------\nPhysical Damage: 20-40\nAttacks per Second: 1.4";
const boots =
  "Item Class: Boots\nRarity: Rare\nRune Pace\nStone Greaves\n--------\nArmour: 100\n--------\n+40 to maximum Life\n25% increased Movement Speed";

describe("diagnoseBuild", () => {
  it("sums resistances and reports the gap to the cap", () => {
    const result = diagnoseBuild(
      [
        { slot: "Ring 1", itemText: ring },
        { slot: "Boots", itemText: boots },
      ],
      genericBuildFitProfile,
    );
    expect(result.resistances.current.fireResistance).toBe(20);
    expect(result.resistances.missing.fireResistance).toBe(55);
  });

  it("warns before removing a slot that another item depends on for an attribute requirement", () => {
    const result = diagnoseBuild(
      [
        { slot: "Ring 1", itemText: ring },
        { slot: "Weapon", itemText: weaponNeedsDex },
      ],
      genericBuildFitProfile,
    );
    const ringAlert = result.alerts.find(
      (a) => a.slot === "Ring 1" && /Dexterity|dexterity/i.test(a.message),
    );
    expect(ringAlert).toBeTruthy();
    expect(ringAlert!.message).toMatch(/before recovering \d+ dexterity/i);
  });

  it("identifies the weakest slots instead of scoring everything the same", () => {
    const result = diagnoseBuild(
      [
        { slot: "Ring 1", itemText: ring },
        { slot: "Boots", itemText: boots },
      ],
      genericBuildFitProfile,
    );
    expect(result.weakestSlots.length).toBeGreaterThan(0);
    expect(
      result.slots.every(
        (s) => s.baseType === null || typeof s.overallScore === "number",
      ),
    ).toBe(true);
    expect(result.profile.equipmentCoverage.filled).toBe(2);
    expect(result.profile.nextMove).toMatch(/Start with/i);
    expect(
      result.slots.find((s) => s.baseType)?.statBreakdown.length,
    ).toBeGreaterThan(0);
  });

  it("warns when removing a resistance item would break the 75% cap", () => {
    const capped =
      "Item Class: Rings\nRarity: Rare\nRuby Loop\nRuby Ring\n+80% to Fire Resistance";
    const result = diagnoseBuild(
      [
        { slot: "Ring 1", itemText: capped },
        { slot: "Boots", itemText: boots },
      ],
      genericBuildFitProfile,
    );
    expect(
      result.alerts.find(
        (a) => a.slot === "Ring 1" && /below the 75% cap/i.test(a.message),
      ),
    ).toBeTruthy();
  });

  it("does not invent a Spirit requirement or a currency budget it cannot verify", () => {
    const result = diagnoseBuild(
      [{ slot: "Boots", itemText: boots }],
      genericBuildFitProfile,
    );
    expect(result.spirit.note).toMatch(/not yet tracked/i);
    expect(result.limitations.join(" ")).toMatch(
      /no verified crafting\/market cost model/i,
    );
    for (const entry of result.recommendedUpgradeOrder)
      expect(["High", "Medium", "Low"]).toContain(entry.budgetPriority);
  });

  it("returns stable diagnostic codes while preserving original prose", () => {
    const result = diagnoseBuild([], genericBuildFitProfile);
    expect(result.structuredLimitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "equipment.empty",
          original: expect.any(String),
        }),
        expect.objectContaining({
          code: "budget.relative_only",
          original: expect.any(String),
        }),
      ]),
    );
    expect(result.limitations).toContain(
      result.structuredLimitations[0].original,
    );
  });
});
