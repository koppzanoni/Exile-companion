import type { SourceEvidence } from './offenceTypes.js';

export interface AilmentScenario {
  kind: 'Ignite' | 'Poison' | 'Bleed' | 'Shock' | 'Chill' | 'Freeze' | 'Armour Break' | 'Exposure' | 'Pin' | 'Stun';
  chance?: number;
  damagePerInstance?: number;
  durationSeconds?: number;
  stackLimit?: number;
  instances?: number;
  penetrationPercent?: number;
  threshold?: number;
  sources?: SourceEvidence[];
}

export interface AilmentResult {
  dps: number | null;
  activeEffect: number | null;
  missingInputs: string[];
  ignoredInputs: string[];
  limitations: string[];
  sources: SourceEvidence[];
}

export function evaluateAilment(scenario: AilmentScenario): AilmentResult {
  const missing: string[] = [];
  const ignored: string[] = [];
  const damaging = scenario.kind === 'Ignite' || scenario.kind === 'Poison' || scenario.kind === 'Bleed';
  if (damaging && scenario.damagePerInstance === undefined) missing.push('damage per ailment instance');
  if (scenario.kind === 'Poison' && scenario.chance === undefined) missing.push('explicit Poison chance');
  if (scenario.kind === 'Poison' && scenario.stackLimit === undefined) missing.push('verified Poison stack limit');
  if (scenario.kind === 'Bleed' && scenario.stackLimit === undefined && (scenario.instances ?? 1) > 1)
    missing.push('verified Bleed stack limit');
  if (scenario.penetrationPercent !== undefined && damaging)
    ignored.push('penetration does not directly scale damaging ailments');
  let dps: number | null = null;
  if (!missing.length && damaging) {
    const instances =
      scenario.kind === 'Ignite'
        ? Math.min(1, scenario.instances ?? 1)
        : Math.min(scenario.instances ?? 1, scenario.stackLimit ?? 1);
    dps = Math.round((scenario.damagePerInstance || 0) * instances * 100) / 100;
  }
  return {
    dps,
    activeEffect: damaging ? null : scenario.threshold === undefined ? null : scenario.threshold,
    missingInputs: missing,
    ignoredInputs: ignored,
    limitations: [
      scenario.kind === 'Ignite'
        ? 'Only the strongest Ignite is counted.'
        : 'Target rarity, threshold and uptime must be supplied by the caller when material.',
    ],
    sources: scenario.sources || [],
  };
}
