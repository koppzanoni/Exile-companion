import { detectItemCategory } from "./categoryDetection.js";
import { mergeItem, parseItemText } from "./itemParser.js";
import {
  deriveBuildWeights,
  deriveCritical,
  deriveDamageTags,
  deriveSlotWeights,
  valueItemStats,
  type StatValuation,
} from "./statValuationEngine.js";
import type { BuildFitProfile, ItemCategory, ItemStats } from "./types.js";

const RESISTANCE_CAP = 75;
const RESISTANCE_KEYS = [
  "fireResistance",
  "coldResistance",
  "lightningResistance",
  "chaosResistance",
] as const;
const ATTRIBUTE_KEYS = ["strength", "dexterity", "intelligence"] as const;
const REQUIREMENT_KEYS = {
  strength: "requiredStrength",
  dexterity: "requiredDexterity",
  intelligence: "requiredIntelligence",
} as const;

export interface EquipmentSlotInput {
  slot: string;
  itemText: string;
}
export interface SlotDiagnosis {
  slot: string;
  baseType: string | null;
  overallScore: number | null;
  weaknessRank: number;
  wastedStats: string[];
  scoreBreakdown: { offence: number; defence: number; utility: number };
  statBreakdown: Array<{
    stat: string;
    value: number;
    score: number;
    category: "offence" | "defence" | "utility";
    reason: string;
    conditional: boolean;
    wasted: boolean;
  }>;
  contributions: {
    resistances: Partial<Record<string, number>>;
    attributes: Partial<Record<string, number>>;
    spirit: number;
    defence: Partial<Record<string, number>>;
  };
}
export interface ProfileAnalysis {
  build: {
    name: string;
    className: string;
    ascendancy?: string;
    mainSkill: string;
    stage: string;
    defensiveLayers: string[];
    damageTypes: string[];
  };
  overallScore: number;
  status: "Critical gaps" | "Needs work" | "Functional" | "Strong";
  equipmentCoverage: { filled: number; total: number; percent: number };
  strengths: string[];
  gaps: string[];
  nextMove: string;
}
export type DiagnosticMessageCode =
  | "equipment.empty"
  | "spirit.target_unknown"
  | "budget.relative_only"
  | "swap.attribute_dependency"
  | "swap.resistance_dependency";
export interface DiagnosticMessage {
  code: DiagnosticMessageCode;
  params: Record<string, string | number>;
  original: string;
}
export interface DependencyAlert extends DiagnosticMessage {
  slot: string;
  message: string;
}
export interface UpgradeOrderEntry {
  slot: string;
  reason: string;
  budgetPriority: "High" | "Medium" | "Low";
}
export interface BuildDoctorResult {
  profile: ProfileAnalysis;
  resistances: {
    current: Record<string, number>;
    missing: Record<string, number>;
    cap: number;
  };
  attributes: {
    total: Record<string, number>;
    required: Record<string, number>;
    met: Record<string, boolean>;
  };
  spirit: {
    current: number;
    required?: number;
    missing?: number;
    note: string;
  };
  defenceByType: Record<string, number>;
  slots: SlotDiagnosis[];
  weakestSlots: string[];
  wastedStatsOverall: string[];
  recommendedUpgradeOrder: UpgradeOrderEntry[];
  alerts: DependencyAlert[];
  limitations: string[];
  structuredLimitations: DiagnosticMessage[];
}

function parseSlot(itemText: string): ItemStats | null {
  if (!itemText.trim()) return null;
  const item = mergeItem(parseItemText(itemText), {});
  return item.baseType || item.itemType ? item : null;
}

function sumField(items: ItemStats[], key: keyof ItemStats): number {
  return items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

export function diagnoseBuild(
  equipment: EquipmentSlotInput[],
  build: BuildFitProfile,
): BuildDoctorResult {
  const parsed = equipment.map((entry) => ({
    slot: entry.slot,
    item: parseSlot(entry.itemText),
  }));
  const items = parsed
    .map((p) => p.item)
    .filter((v): v is ItemStats => Boolean(v));
  const limitations: string[] = [];
  const structuredLimitations: DiagnosticMessage[] = [];
  const addLimitation = (
    code: DiagnosticMessageCode,
    original: string,
    params: Record<string, string | number> = {},
  ) => {
    limitations.push(original);
    structuredLimitations.push({ code, params, original });
  };
  if (!items.length)
    addLimitation(
      "equipment.empty",
      "No equipment was pasted, so this diagnosis reflects an empty character.",
    );

  const resistanceCurrent: Record<string, number> = {};
  const resistanceMissing: Record<string, number> = {};
  for (const key of RESISTANCE_KEYS) {
    const value = sumField(items, key);
    resistanceCurrent[key] = value;
    resistanceMissing[key] = Math.max(0, RESISTANCE_CAP - value);
  }

  const attributesTotal: Record<string, number> = {};
  const attributesRequired: Record<string, number> = {};
  const attributesMet: Record<string, boolean> = {};
  for (const attr of ATTRIBUTE_KEYS) {
    attributesTotal[attr] = sumField(items, attr);
    const requirementKey = REQUIREMENT_KEYS[attr];
    attributesRequired[attr] = Math.max(
      0,
      ...items.map((item) => Number(item[requirementKey]) || 0),
    );
    attributesMet[attr] = attributesTotal[attr] >= attributesRequired[attr];
  }

  const spirit = sumField(items, "spirit");
  const spiritRequired = Number(build.spiritTarget) || 0;
  const defenceByType = {
    armour: sumField(items, "armour"),
    evasion: sumField(items, "evasion"),
    energyShield: sumField(items, "energyShield"),
    deflection: sumField(items, "deflection"),
    runicWard: sumField(items, "runicWard"),
    blockChance: sumField(items, "blockChance"),
  };

  const critical = deriveCritical(build);
  const damageTags = deriveDamageTags(build);
  const buildWeight = deriveBuildWeights(build);
  const baseContext = {
    critical,
    damageTags,
    current: {
      ...resistanceCurrent,
      spirit,
      strength: attributesTotal.strength,
      dexterity: attributesTotal.dexterity,
      intelligence: attributesTotal.intelligence,
    },
    buildWeight,
  };

  const slots: SlotDiagnosis[] = parsed.map(({ slot, item }) => {
    if (!item)
      return {
        slot,
        baseType: null,
        overallScore: null,
        weaknessRank: 0,
        wastedStats: [],
        scoreBreakdown: { offence: 0, defence: 0, utility: 0 },
        statBreakdown: [],
        contributions: {
          resistances: {},
          attributes: {},
          spirit: 0,
          defence: {},
        },
      };
    const category: ItemCategory = detectItemCategory(item).key;
    const valuation: StatValuation = valueItemStats(item, {
      ...baseContext,
      slot: category,
      slotWeight: deriveSlotWeights(build, category),
    });
    const wasted = valuation.contributions
      .filter((c) => c.wasted)
      .map((c) => c.stat);
    return {
      slot,
      baseType: item.baseType || item.itemType,
      overallScore: valuation.overallScore,
      weaknessRank: valuation.overallScore,
      wastedStats: wasted,
      scoreBreakdown: {
        offence: valuation.offenceScore,
        defence: valuation.defenceScore,
        utility: valuation.utilityScore,
      },
      statBreakdown: valuation.contributions.map((entry) => ({
        stat: entry.stat,
        value: entry.value,
        score: entry.score,
        category: entry.category,
        reason: entry.reason,
        conditional: entry.conditional,
        wasted: entry.wasted,
      })),
      contributions: {
        resistances: Object.fromEntries(
          RESISTANCE_KEYS.map((key) => [key, item[key] || 0]),
        ),
        attributes: Object.fromEntries(
          ATTRIBUTE_KEYS.map((key) => [key, item[key] || 0]),
        ),
        spirit: item.spirit || 0,
        defence: {
          armour: item.armour || 0,
          evasion: item.evasion || 0,
          energyShield: item.energyShield || 0,
          deflection: item.deflection || 0,
          runicWard: item.runicWard || 0,
          blockChance: item.blockChance || 0,
        },
      },
    };
  });

  const filledSlots = slots.filter((s) => s.baseType);
  const weakestSlots = [...filledSlots]
    .sort((a, b) => (a.overallScore ?? 0) - (b.overallScore ?? 0))
    .slice(0, 3)
    .map((s) => s.slot);
  const wastedStatsOverall = [
    ...new Set(filledSlots.flatMap((s) => s.wastedStats)),
  ];

  const alerts: DependencyAlert[] = [];
  for (const { slot, item } of parsed) {
    if (!item) continue;
    const others = parsed
      .filter((p) => p.slot !== slot && p.item)
      .map((p) => p.item as ItemStats);
    for (const attr of ATTRIBUTE_KEYS) {
      const remaining = sumField(others, attr);
      const otherRequirement = Math.max(
        0,
        ...others.map((o) => Number(o[REQUIREMENT_KEYS[attr]]) || 0),
      );
      if (remaining < otherRequirement) {
        const gap = otherRequirement - remaining;
        const message = `Do not replace this ${slot} before recovering ${gap} ${attr}; another equipped item requires ${otherRequirement} ${attr} and only ${remaining} would remain.`;
        alerts.push({
          slot,
          message,
          code: "swap.attribute_dependency",
          params: {
            slot,
            gap,
            attribute: attr,
            required: otherRequirement,
            remaining,
          },
          original: message,
        });
      }
    }
    for (const key of RESISTANCE_KEYS) {
      const remaining = sumField(others, key);
      if (remaining < RESISTANCE_CAP) {
        const resistance = key.replace("Resistance", " resistance");
        const missing = RESISTANCE_CAP - remaining;
        const message = `Do not replace this ${slot} before recovering ${missing}% ${resistance}; removing it would leave ${remaining}%, below the ${RESISTANCE_CAP}% cap.`;
        alerts.push({
          slot,
          message,
          code: "swap.resistance_dependency",
          params: { slot, resistance, missing, remaining, cap: RESISTANCE_CAP },
          original: message,
        });
      }
    }
  }

  const recommendedUpgradeOrder: UpgradeOrderEntry[] = [...filledSlots]
    .sort((a, b) => (a.overallScore ?? 0) - (b.overallScore ?? 0))
    .slice(0, 5)
    .map((s) => ({
      slot: s.slot,
      reason: s.wastedStats.length
        ? `Lowest stat-valuation score (${s.overallScore}/100) with wasted stats: ${s.wastedStats.join(", ")}.`
        : `Lowest stat-valuation score (${s.overallScore}/100) among equipped items.`,
      budgetPriority:
        (s.overallScore ?? 0) < 30
          ? "High"
          : (s.overallScore ?? 0) < 60
            ? "Medium"
            : "Low",
    }));

  if (!spiritRequired)
    addLimitation(
      "spirit.target_unknown",
      "Spirit demand is unknown because this build profile has no Spirit target. Add the target from its active skills/gems to make this check exact.",
    );
  addLimitation(
    "budget.relative_only",
    "Suggested budget is a relative priority (High/Medium/Low), not a currency amount, because no verified crafting/market cost model is attached to this diagnosis.",
  );

  const cappedResistances = RESISTANCE_KEYS.filter(
    (key) => resistanceCurrent[key] >= RESISTANCE_CAP,
  );
  const unmetAttributes = ATTRIBUTE_KEYS.filter((key) => !attributesMet[key]);
  const averageSlotScore = filledSlots.length
    ? Math.round(
        filledSlots.reduce((sum, slot) => sum + (slot.overallScore || 0), 0) /
          filledSlots.length,
      )
    : 0;
  const coveragePercent = Math.round(
    (filledSlots.length / Math.max(1, equipment.length)) * 100,
  );
  const criticalGapCount =
    RESISTANCE_KEYS.filter((key) => resistanceMissing[key] > 0).length +
    unmetAttributes.length +
    (spiritRequired > spirit ? 1 : 0);
  const overallScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        averageSlotScore * 0.65 +
          (cappedResistances.length / RESISTANCE_KEYS.length) * 25 +
          (coveragePercent / 100) * 10 -
          criticalGapCount * 4,
      ),
    ),
  );
  const status: ProfileAnalysis["status"] =
    criticalGapCount >= 4
      ? "Critical gaps"
      : overallScore < 45
        ? "Needs work"
        : overallScore < 72
          ? "Functional"
          : "Strong";
  const strengths: string[] = [];
  if (cappedResistances.length)
    strengths.push(
      `${cappedResistances.length} of ${RESISTANCE_KEYS.length} tracked resistances are capped.`,
    );
  if (!unmetAttributes.length)
    strengths.push("Equipment attribute requirements are currently met.");
  if (spiritRequired && spirit >= spiritRequired)
    strengths.push(`Spirit target of ${spiritRequired} is met.`);
  const strongest = [...filledSlots].sort(
    (a, b) => (b.overallScore || 0) - (a.overallScore || 0),
  )[0];
  if (strongest)
    strengths.push(
      `${strongest.slot} is the strongest evaluated slot at ${strongest.overallScore}/100.`,
    );
  const gaps = RESISTANCE_KEYS.filter((key) => resistanceMissing[key] > 0).map(
    (key) =>
      `${resistanceMissing[key]}% ${key.replace("Resistance", " resistance")} missing`,
  );
  gaps.push(
    ...unmetAttributes.map(
      (key) =>
        `${attributesRequired[key] - attributesTotal[key]} ${key} missing for equipment requirements`,
    ),
  );
  if (spiritRequired > spirit)
    gaps.push(
      `${spiritRequired - spirit} Spirit missing for the selected build target`,
    );
  if (wastedStatsOverall.length)
    gaps.push(`Wasted stats detected: ${wastedStatsOverall.join(", ")}`);
  const firstUpgrade = recommendedUpgradeOrder[0];
  const nextMove = firstUpgrade
    ? `Start with ${firstUpgrade.slot}: ${firstUpgrade.reason}`
    : "Add equipped items to generate a prioritized next move.";

  return {
    profile: {
      build: {
        name: build.name,
        className: build.className,
        ascendancy: build.ascendancy,
        mainSkill: build.mainSkill,
        stage: build.stage,
        defensiveLayers: build.defensiveLayers,
        damageTypes: build.damageTypes,
      },
      overallScore,
      status,
      equipmentCoverage: {
        filled: filledSlots.length,
        total: equipment.length,
        percent: coveragePercent,
      },
      strengths,
      gaps,
      nextMove,
    },
    resistances: {
      current: resistanceCurrent,
      missing: resistanceMissing,
      cap: RESISTANCE_CAP,
    },
    attributes: {
      total: attributesTotal,
      required: attributesRequired,
      met: attributesMet,
    },
    spirit: spiritRequired
      ? {
          current: spirit,
          required: spiritRequired,
          missing: Math.max(0, spiritRequired - spirit),
          note:
            spirit >= spiritRequired
              ? `Spirit target of ${spiritRequired} is met by saved equipment.`
              : `Missing ${spiritRequired - spirit} Spirit to reach the build target of ${spiritRequired}.`,
        }
      : {
          current: spirit,
          note: "Spirit demand is not yet tracked because the selected build has no Spirit target.",
        },
    defenceByType,
    slots,
    weakestSlots,
    wastedStatsOverall,
    recommendedUpgradeOrder,
    alerts,
    limitations,
    structuredLimitations,
  };
}
