import { detectItemCategory } from './categoryDetection.js';
import { mergeItem, parseItemText } from './itemParser.js';
import { deriveBuildWeights, deriveCritical, deriveDamageTags, deriveSlotWeights, valueItemStats, type StatValuation } from './statValuationEngine.js';
import type { BuildFitProfile, ItemCategory, ItemStats } from './types.js';

const RESISTANCE_CAP = 75;
const RESISTANCE_KEYS = ['fireResistance', 'coldResistance', 'lightningResistance', 'chaosResistance'] as const;
const ATTRIBUTE_KEYS = ['strength', 'dexterity', 'intelligence'] as const;
const REQUIREMENT_KEYS = { strength: 'requiredStrength', dexterity: 'requiredDexterity', intelligence: 'requiredIntelligence' } as const;

export interface EquipmentSlotInput { slot: string; itemText: string }
export interface SlotDiagnosis {
  slot: string;
  baseType: string | null;
  overallScore: number | null;
  weaknessRank: number;
  wastedStats: string[];
  contributions: { resistances: Partial<Record<string, number>>; attributes: Partial<Record<string, number>>; spirit: number; defence: Partial<Record<string, number>> };
}
export interface DependencyAlert { slot: string; message: string }
export interface UpgradeOrderEntry { slot: string; reason: string; budgetPriority: 'High' | 'Medium' | 'Low' }
export interface BuildDoctorResult {
  resistances: { current: Record<string, number>; missing: Record<string, number>; cap: number };
  attributes: { total: Record<string, number>; required: Record<string, number>; met: Record<string, boolean> };
  spirit: { current: number; required?: number; missing?: number; note: string };
  defenceByType: Record<string, number>;
  slots: SlotDiagnosis[];
  weakestSlots: string[];
  wastedStatsOverall: string[];
  recommendedUpgradeOrder: UpgradeOrderEntry[];
  alerts: DependencyAlert[];
  limitations: string[];
}

function parseSlot(itemText: string): ItemStats | null {
  if (!itemText.trim()) return null;
  const item = mergeItem(parseItemText(itemText), {});
  return item.baseType || item.itemType ? item : null;
}

function sumField(items: ItemStats[], key: keyof ItemStats): number {
  return items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

export function diagnoseBuild(equipment: EquipmentSlotInput[], build: BuildFitProfile): BuildDoctorResult {
  const parsed = equipment.map((entry) => ({ slot: entry.slot, item: parseSlot(entry.itemText) }));
  const items = parsed.map((p) => p.item).filter((v): v is ItemStats => Boolean(v));
  const limitations: string[] = [];
  if (!items.length) limitations.push('No equipment was pasted, so this diagnosis reflects an empty character.');

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
    attributesRequired[attr] = Math.max(0, ...items.map((item) => Number(item[requirementKey]) || 0));
    attributesMet[attr] = attributesTotal[attr] >= attributesRequired[attr];
  }

  const spirit = sumField(items, 'spirit');
  const spiritRequired = Number(build.spiritTarget) || 0;
  const defenceByType = { armour: sumField(items, 'armour'), evasion: sumField(items, 'evasion'), energyShield: sumField(items, 'energyShield'), deflection: sumField(items, 'deflection'), runicWard: sumField(items, 'runicWard') };

  const critical = deriveCritical(build);
  const damageTags = deriveDamageTags(build);
  const buildWeight = deriveBuildWeights(build);
  const baseContext = { critical, damageTags, current: { ...resistanceCurrent, spirit, strength: attributesTotal.strength, dexterity: attributesTotal.dexterity, intelligence: attributesTotal.intelligence }, buildWeight };

  const slots: SlotDiagnosis[] = parsed.map(({ slot, item }) => {
    if (!item) return { slot, baseType: null, overallScore: null, weaknessRank: 0, wastedStats: [], contributions: { resistances: {}, attributes: {}, spirit: 0, defence: {} } };
    const category: ItemCategory = detectItemCategory(item).key;
    const valuation: StatValuation = valueItemStats(item, { ...baseContext, slot: category, slotWeight: deriveSlotWeights(build, category) });
    const wasted = valuation.contributions.filter((c) => c.wasted).map((c) => c.stat);
    return {
      slot, baseType: item.baseType || item.itemType, overallScore: valuation.overallScore, weaknessRank: valuation.overallScore, wastedStats: wasted,
      contributions: {
        resistances: Object.fromEntries(RESISTANCE_KEYS.map((key) => [key, item[key] || 0])),
        attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, item[key] || 0])),
        spirit: item.spirit || 0,
        defence: { armour: item.armour || 0, evasion: item.evasion || 0, energyShield: item.energyShield || 0, deflection: item.deflection || 0, runicWard: item.runicWard || 0 },
      },
    };
  });

  const filledSlots = slots.filter((s) => s.baseType);
  const weakestSlots = [...filledSlots].sort((a, b) => (a.overallScore ?? 0) - (b.overallScore ?? 0)).slice(0, 3).map((s) => s.slot);
  const wastedStatsOverall = [...new Set(filledSlots.flatMap((s) => s.wastedStats))];

  const alerts: DependencyAlert[] = [];
  for (const { slot, item } of parsed) {
    if (!item) continue;
    const others = parsed.filter((p) => p.slot !== slot && p.item).map((p) => p.item as ItemStats);
    for (const attr of ATTRIBUTE_KEYS) {
      const remaining = sumField(others, attr);
      const otherRequirement = Math.max(0, ...others.map((o) => Number(o[REQUIREMENT_KEYS[attr]]) || 0));
      if (remaining < otherRequirement) {
        const gap = otherRequirement - remaining;
        alerts.push({ slot, message: `Do not replace this ${slot} before recovering ${gap} ${attr}; another equipped item requires ${otherRequirement} ${attr} and only ${remaining} would remain.` });
      }
    }
    for (const key of RESISTANCE_KEYS) {
      const remaining = sumField(others, key);
      if (remaining < RESISTANCE_CAP) alerts.push({ slot, message: `Do not replace this ${slot} before recovering ${RESISTANCE_CAP - remaining}% ${key.replace('Resistance', ' resistance')}; removing it would leave ${remaining}%, below the ${RESISTANCE_CAP}% cap.` });
    }
  }

  const recommendedUpgradeOrder: UpgradeOrderEntry[] = [...filledSlots]
    .sort((a, b) => (a.overallScore ?? 0) - (b.overallScore ?? 0))
    .slice(0, 5)
    .map((s) => ({
      slot: s.slot,
      reason: s.wastedStats.length ? `Lowest stat-valuation score (${s.overallScore}/100) with wasted stats: ${s.wastedStats.join(', ')}.` : `Lowest stat-valuation score (${s.overallScore}/100) among equipped items.`,
      budgetPriority: (s.overallScore ?? 0) < 30 ? 'High' : (s.overallScore ?? 0) < 60 ? 'Medium' : 'Low',
    }));

  if (!spiritRequired) limitations.push('Spirit demand is unknown because this build profile has no Spirit target. Add the target from its active skills/gems to make this check exact.');
  limitations.push('Suggested budget is a relative priority (High/Medium/Low), not a currency amount, because no verified crafting/market cost model is attached to this diagnosis.');

  return {
    resistances: { current: resistanceCurrent, missing: resistanceMissing, cap: RESISTANCE_CAP },
    attributes: { total: attributesTotal, required: attributesRequired, met: attributesMet },
    spirit: spiritRequired ? { current: spirit, required: spiritRequired, missing: Math.max(0, spiritRequired - spirit), note: spirit >= spiritRequired ? `Spirit target of ${spiritRequired} is met by saved equipment.` : `Missing ${spiritRequired - spirit} Spirit to reach the build target of ${spiritRequired}.` } : { current: spirit, note: 'Spirit demand is not yet tracked because the selected build has no Spirit target.' },
    defenceByType,
    slots, weakestSlots, wastedStatsOverall, recommendedUpgradeOrder, alerts, limitations,
  };
}
