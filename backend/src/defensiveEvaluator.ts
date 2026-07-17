import type { DamageType, DefensiveScenario, SourceEvidence } from './offenceTypes.js';

export interface DefensiveInputs {
  life?: number;
  energyShield?: number;
  manaProtection?: number;
  runicWard?: number;
  resistances?: Partial<Record<DamageType, number>>;
  maximumResistances?: Partial<Record<DamageType, number>>;
  armour?: number;
  blockChance?: number;
  sources?: SourceEvidence[];
}

export interface DefensiveResult {
  mitigatedHit: number | null;
  maximumHit: number | null;
  resistanceUsed: number | null;
  armourReduction: number | null;
  covered: string[];
  missingInputs: string[];
  assumptions: string[];
  sources: SourceEvidence[];
  confidence: 'High' | 'Medium' | 'Low';
}

/** Pure scenario evaluator. Armour deliberately remains unknown until its patch formula is catalogued. */
export function evaluateDefence(inputs: DefensiveInputs, scenario: DefensiveScenario): DefensiveResult {
  const missing: string[] = [];
  const covered: string[] = [];
  const maxResistance = inputs.maximumResistances?.[scenario.damageType] ?? 75;
  const suppliedResistance = scenario.damageType === 'physical' ? null : inputs.resistances?.[scenario.damageType];
  const resistance =
    suppliedResistance === undefined
      ? null
      : suppliedResistance === null
        ? null
        : Math.min(maxResistance, suppliedResistance);
  if (scenario.damageType !== 'physical' && resistance === null) missing.push(`${scenario.damageType} resistance`);
  if (resistance !== null) covered.push('resistance cap');
  let mitigatedHit: number | null =
    resistance === null && scenario.damageType !== 'physical'
      ? null
      : scenario.incomingHit * (1 - (resistance ?? 0) / 100);
  const armourReduction: number | null = null;
  if (scenario.damageType === 'physical' && scenario.armourAppliesPercent > 0) {
    missing.push('versioned PoE2 armour formula for the selected hit size');
    mitigatedHit = null;
  }
  const pool = (inputs.life ?? 0) + (inputs.energyShield ?? 0) + (inputs.runicWard ?? 0) + (inputs.manaProtection ?? 0);
  if (!pool) missing.push('effective protection pool');
  const maximumHit =
    mitigatedHit !== null && mitigatedHit > 0 && pool > 0
      ? Math.round(((pool * scenario.incomingHit) / mitigatedHit) * 100) / 100
      : null;
  const assumptions = [
    'Protection pools are treated as fully available for this isolated hit; recovery and bypass require separate scenarios.',
  ];
  // Block chance determines whether this hit occurs at all, not how much of it is mitigated once
  // it lands — it is intentionally not folded into mitigatedHit/maximumHit for a single isolated hit.
  if (inputs.blockChance)
    assumptions.push(
      "Block chance is not applied to this isolated hit's mitigation; it affects whether the hit connects at all, which requires an expected-value scenario across multiple hits, not a single one.",
    );
  return {
    mitigatedHit: mitigatedHit === null ? null : Math.round(mitigatedHit * 100) / 100,
    maximumHit,
    resistanceUsed: resistance,
    armourReduction,
    covered,
    missingInputs: missing,
    assumptions,
    sources: inputs.sources || [],
    confidence: missing.length ? 'Low' : 'Medium',
  };
}
