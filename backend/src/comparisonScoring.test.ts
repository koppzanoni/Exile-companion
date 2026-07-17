import { describe, expect, it } from "vitest";
import { scoreComparisonDimensions } from "./comparisonScoring.js";
import type { ScoringContext } from "./buildScoringContext.js";
import type { ItemCategory, ItemEvaluation, ItemStats } from "./types.js";

const item = (overrides: Partial<ItemStats> = {}): ItemStats => ({
  itemType: "Test",
  baseType: "Test",
  rarity: "rare",
  customMods: [],
  ...overrides,
});

const evaluation = (): ItemEvaluation => ({
  score: 50,
  grade: "good",
  label: "test",
  verdict: "test",
  marketability: "niche",
  strengths: [],
  weaknesses: [],
  buildFits: [],
  upgradePriorities: [],
});

const NEUTRAL: ScoringContext = { critical: false, damageTags: [], current: {} };
const CRITICAL: ScoringContext = { critical: true, damageTags: [], current: {} };

describe("comparisonScoring shared context", () => {
  it("only credits critical value toward the offensive dimension for a critical build", () => {
    const bow = item({ criticalDamageBonus: 20 });
    const withCrit = scoreComparisonDimensions(bow, "bow", evaluation(), CRITICAL);
    const withoutCrit = scoreComparisonDimensions(bow, "bow", evaluation(), NEUTRAL);
    expect(withCrit.offensive).toBeGreaterThan(withoutCrit.offensive);
    expect(withoutCrit.offensive).toBe(0);
  });

  it("weights the shared critical value by the category-specific constant", () => {
    const bow = item({ criticalDamageBonus: 20 });
    const dimensions = scoreComparisonDimensions(bow, "bow", evaluation(), CRITICAL);
    expect(dimensions.offensive).toBeCloseTo(20 * 1.5, 5);
  });

  it("does not credit an over-cap resistance roll toward the defensive dimension", () => {
    const ring = item({ fireResistance: 40 });
    const freshCharacter: ScoringContext = { ...NEUTRAL, current: { fireResistance: 0 } };
    const cappedCharacter: ScoringContext = { ...NEUTRAL, current: { fireResistance: 75 } };
    const fresh = scoreComparisonDimensions(ring, "ring", evaluation(), freshCharacter);
    const capped = scoreComparisonDimensions(ring, "ring", evaluation(), cappedCharacter);
    expect(fresh.defensive).toBeGreaterThan(capped.defensive);
    expect(capped.defensive).toBe(0);
  });

  it("respects an explicit build resistance cap when substituting the effective value", () => {
    const ring = item({ fireResistance: 40 });
    const lowCap: ScoringContext = {
      ...NEUTRAL,
      current: { fireResistance: 0 },
      caps: { fireResistance: 20 },
    };
    const dimensions = scoreComparisonDimensions(ring, "ring", evaluation(), lowCap);
    expect(dimensions.defensive).toBeCloseTo(20 * 0.24, 5);
  });

  it("still scores life and armour unconditionally, independent of the build context", () => {
    const boots = item({ life: 100, evasion: 400 });
    const dimensions = scoreComparisonDimensions(boots, "boots" as ItemCategory, evaluation(), NEUTRAL);
    expect(dimensions.defensive).toBeGreaterThan(0);
  });
});
