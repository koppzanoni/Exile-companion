import type {
  BuildFitProfile,
  ItemCategoryInfo,
  ItemEvaluation,
  ItemStats,
  KnowledgeAssessment,
  ModifierRollInsight,
} from './types.js';
import { analyzeItemCategory } from './categoryAnalysis.js';

const RULESET = 'PoE 2 equipment knowledge 0.5';

const universal =
  /maximum Life|maximum Mana|Resistance|Strength|Dexterity|Intelligence|all Attributes|Spirit|Rarity of Items|Regeneration|Stun Threshold|Skill/i;
const categoryPatterns: Record<string, RegExp> = {
  'body-armour': /Armour|Evasion|Energy Shield|Spirit|maximum Life|Damage taken|maximum Resistance|Recoup/i,
  helmet: /Armour|Evasion|Energy Shield|maximum Life|Mana|Resistance|Skill|Accuracy/i,
  gloves:
    /Armour|Evasion|Energy Shield|maximum Life|Resistance|Attack Speed|Cast Speed|Accuracy|Damage to Attacks|Critical/i,
  boots: /Movement Speed|Armour|Evasion|Energy Shield|maximum Life|Resistance|Attribute/i,
  shield: /Chance to Block|Armour|Evasion|Energy Shield|maximum Life|Resistance|Raise Shield|Parry/i,
  focus: /Energy Shield|Spell Damage|Cast Speed|Critical|Mana|Spirit|Skill|Minion/i,
  quiver: /Projectile|Bow|Damage to Attacks|Attack Speed|Critical|Accuracy/i,
  ring: /Resistance|Attribute|maximum Life|maximum Mana|Damage to Attacks|Attack Speed|Cast Speed|Critical|Rarity/i,
  amulet: /Skill|Spirit|Attribute|maximum Life|Resistance|Critical|Damage|Reservation/i,
  belt: /maximum Life|Resistance|Strength|Charm|Flask|Stun Threshold|Regeneration/i,
  bow: /Damage|Attack Speed|Critical|Projectile|Arrow|Accuracy|Skill/i,
  crossbow: /Damage|Attack Speed|Critical|Projectile|Grenade|Reload|Accuracy|Skill/i,
  'one-handed-melee': /Damage|Attack Speed|Critical|Accuracy|Leech|Skill|Stun/i,
  'two-handed-melee': /Damage|Attack Speed|Critical|Accuracy|Leech|Skill|Stun/i,
  quarterstaff: /Damage|Attack Speed|Critical|Accuracy|Leech|Skill|Stun|Elemental/i,
  staff: /Spell Damage|Cast Speed|Critical|Mana|Spirit|Skill|Minion/i,
  wand: /Spell Damage|Cast Speed|Critical|Mana|Spirit|Skill|Minion/i,
  sceptre: /Spell Damage|Cast Speed|Critical|Mana|Spirit|Skill|Minion|Ally/i,
  other: /./,
};

export function applyItemKnowledge(
  evaluation: ItemEvaluation,
  item: ItemStats,
  category: ItemCategoryInfo,
  profile?: BuildFitProfile | null,
): ItemEvaluation {
  const stage = profile?.stage || 'endgame';
  const knowledge = assessItemKnowledge(item, category, stage);
  const rollAverage = knowledge.rolls.length
    ? knowledge.rolls.reduce((sum, roll) => sum + roll.percentile, 0) / knowledge.rolls.length
    : undefined;
  let score = evaluation.score;
  const strengths = [...evaluation.strengths];
  const weaknesses = [...evaluation.weaknesses];
  if (rollAverage !== undefined && knowledge.rolls.length >= 2) {
    if (rollAverage >= 85) {
      score += 4;
      strengths.push(`Excellent modifier rolls (${Math.round(rollAverage)}% average within their ranges)`);
    } else if (rollAverage <= 20) {
      score -= 3;
      weaknesses.push(`Low modifier rolls (${Math.round(rollAverage)}% average within their ranges)`);
    }
  }
  const tierOne = knowledge.rolls.filter((roll) => roll.tier === 1).length;
  if (tierOne) strengths.push(`${tierOne} top-tier (Tier 1) modifier${tierOne === 1 ? '' : 's'} detected`);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade: ItemEvaluation['grade'] =
    score >= 88 ? 'elite' : score >= 74 ? 'excellent' : score >= 55 ? 'good' : score >= 34 ? 'basic' : 'poor';
  const label =
    grade === 'elite'
      ? 'Elite endgame item'
      : grade === 'excellent'
        ? 'Excellent endgame item'
        : grade === 'good'
          ? 'Good, build-usable item'
          : grade === 'basic'
            ? 'Usable but replaceable'
            : 'Low-value / early upgrade';
  const enriched: ItemEvaluation = {
    ...evaluation,
    score,
    grade,
    label,
    strengths: unique(strengths).slice(0, 7),
    weaknesses: unique(weaknesses).slice(0, 6),
    knowledge,
  };
  return { ...enriched, categoryAnalysis: analyzeItemCategory(item, enriched) };
}

export function assessItemKnowledge(
  item: ItemStats,
  category: ItemCategoryInfo,
  stage: BuildFitProfile['stage'],
): KnowledgeAssessment {
  const mods = item.customMods || [];
  const pattern = categoryPatterns[category.key] || categoryPatterns.other;
  const recognized = mods.filter((line) => universal.test(line) || pattern.test(line)).length;
  const rolls = parseRolls(item.rawText || '');
  const reasons: string[] = [];
  const warnings: string[] = [];
  let confidence = 15;
  if (category.key !== 'other') {
    confidence += 20;
    reasons.push(`Category confidently identified as ${category.label}`);
  } else warnings.push('Item category was not confidently identified');
  if (item.rawText) {
    confidence += 15;
    reasons.push('Full copied item text is available');
  } else warnings.push('Manual fields omit modifier tiers and roll ranges');
  if (item.itemLevel) {
    confidence += 10;
    reasons.push(`Item level ${item.itemLevel} was read`);
  } else warnings.push('Item level is missing, so affix potential cannot be checked');
  const ratio = mods.length ? recognized / mods.length : 0;
  confidence += Math.round(ratio * 25);
  if (mods.length && ratio >= 0.7) reasons.push('Most explicit modifiers matched the slot knowledge base');
  else if (mods.length) warnings.push('Some specialised modifiers are not yet fully modelled');
  else warnings.push('No explicit modifiers were detected');
  if (rolls.length) {
    confidence += 15;
    reasons.push(`${rolls.length} advanced modifier roll${rolls.length === 1 ? '' : 's'} parsed`);
  } else warnings.push('Enable Advanced Item Descriptions before copying to include tiers and roll ranges');
  if (item.rarity === 'unique') {
    confidence -= 15;
    warnings.push('Unique-item interactions require build-specific interpretation');
  }
  confidence = Math.max(0, Math.min(100, confidence));
  const itemLevelNote = itemLevelNoteFor(item.itemLevel, stage);
  const craftingNotes: string[] = [];
  if (item.corrupted) craftingNotes.push('Corrupted: normal crafting changes are no longer available');
  if (item.sanctified)
    craftingNotes.push('Sanctified: modifier magnitudes are enhanced but most crafting is restricted');
  if ((item.quality || 0) > 20) craftingNotes.push(`${item.quality}% quality is above the normal 20% equipment cap`);
  else if ((item.quality || 0) > 0)
    craftingNotes.push(`${item.quality}% quality is already included in displayed local defence or weapon damage`);
  return {
    ruleset: RULESET,
    confidence: {
      score: confidence,
      level: confidence >= 80 ? 'high' : confidence >= 55 ? 'medium' : 'low',
      reasons,
      warnings,
    },
    rolls,
    recognizedModifiers: recognized,
    totalModifiers: mods.length,
    itemLevelNote,
    craftingNotes,
  };
}

function parseRolls(raw: string): ModifierRollInsight[] {
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const result: ModifierRollInsight[] = [];
  let tier: number | undefined;
  for (const line of lines) {
    const tierMatch = line.match(/\(Tier:\s*(\d+)\)/i);
    if (tierMatch) {
      tier = Number(tierMatch[1]);
      continue;
    }
    if (/^\{/.test(line)) continue;
    const ranges = [...line.matchAll(/([+-]?\d+(?:\.\d+)?)\(([+-]?\d+(?:\.\d+)?)-([+-]?\d+(?:\.\d+)?)\)/g)];
    if (!ranges.length) continue;
    const percentiles = ranges.map((match) => {
      const value = Number(match[1]);
      const min = Number(match[2]);
      const max = Number(match[3]);
      return max === min ? 100 : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    });
    const percentile = Math.round(percentiles.reduce((sum, value) => sum + value, 0) / percentiles.length);
    result.push({
      modifier: line,
      tier,
      percentile,
      label: percentile >= 99 ? 'perfect' : percentile >= 75 ? 'high' : percentile >= 35 ? 'average' : 'low',
    });
    tier = undefined;
  }
  return result.slice(0, 8);
}

function itemLevelNoteFor(itemLevel: number | undefined, stage: BuildFitProfile['stage']) {
  if (!itemLevel) return 'Item level unknown: current stats can be judged, but crafting and affix potential cannot.';
  if (stage === 'campaign')
    return `Item level ${itemLevel}: judged for immediate campaign usefulness rather than endgame crafting potential.`;
  if (itemLevel >= 78)
    return `Item level ${itemLevel}: capable of high-level affix tiers; item level is potential, not proof of good current rolls.`;
  if (itemLevel >= 65) return `Item level ${itemLevel}: map-capable base, but some top affix tiers may be unavailable.`;
  return `Item level ${itemLevel}: limited endgame affix potential; evaluate mainly as a temporary upgrade.`;
}
const unique = (values: string[]) => [...new Set(values)];
