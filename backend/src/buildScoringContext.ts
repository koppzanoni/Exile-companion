import type { BuildFitProfile, CharacterTotals, ItemCategory } from './types.js';

export interface ScoringContext {
  critical: boolean;
  damageTags: string[];
  current: Partial<CharacterTotals> & { life?: number; mana?: number };
  requirements?: Partial<Record<'spirit' | 'strength' | 'dexterity' | 'intelligence', number>>;
  caps?: Partial<Record<'fireResistance' | 'coldResistance' | 'lightningResistance' | 'chaosResistance', number>>;
}

export function deriveScoringContext(
  build: BuildFitProfile,
  current?: Partial<CharacterTotals> & { life?: number; mana?: number },
): ScoringContext {
  return {
    critical: deriveCritical(build),
    damageTags: deriveDamageTags(build),
    current: current ?? {},
    requirements: {
      strength: build.attributeRequirements?.strength ?? build.priorities.find((p) => p.stat === 'strength')?.minimum,
      dexterity:
        build.attributeRequirements?.dexterity ?? build.priorities.find((p) => p.stat === 'dexterity')?.minimum,
      intelligence:
        build.attributeRequirements?.intelligence ?? build.priorities.find((p) => p.stat === 'intelligence')?.minimum,
      spirit: build.spiritTarget ?? build.priorities.find((p) => p.stat === 'spirit')?.minimum,
    },
    caps: {
      fireResistance:
        build.resistanceCaps?.fireResistance ?? build.priorities.find((p) => p.stat === 'fireResistance')?.minimum,
      coldResistance:
        build.resistanceCaps?.coldResistance ?? build.priorities.find((p) => p.stat === 'coldResistance')?.minimum,
      lightningResistance:
        build.resistanceCaps?.lightningResistance ??
        build.priorities.find((p) => p.stat === 'lightningResistance')?.minimum,
      chaosResistance:
        build.resistanceCaps?.chaosResistance ?? build.priorities.find((p) => p.stat === 'chaosResistance')?.minimum,
    },
  };
}

const statNeedles: Record<string, string> = {
  life: 'life',
  fireResistance: 'fire resistance',
  coldResistance: 'cold resistance',
  lightningResistance: 'lightning resistance',
  chaosResistance: 'chaos resistance',
  strength: 'strength',
  dexterity: 'dexterity',
  intelligence: 'intelligence',
  spirit: 'spirit',
  'Maximum Life': 'life',
  'Physical DPS': 'physical damage',
  'Elemental DPS': 'elemental damage',
  'Critical scaling': 'critical',
};

export function deriveBuildWeights(build: BuildFitProfile): Partial<Record<string, number>> {
  const phrases = [...build.offensiveStats, ...build.defensiveStats, ...build.attributes, ...build.utilityStats].map(
    (phrase) => phrase.toLowerCase(),
  );
  const result: Partial<Record<string, number>> = {};
  for (const [key, needle] of Object.entries(statNeedles))
    if (phrases.some((phrase) => phrase.includes(needle))) result[key] = 2;
  return result;
}

export function deriveSlotWeights(build: BuildFitProfile, slot: ItemCategory): Partial<Record<string, number>> {
  const phrases = (build.categoryPriorities[slot] || []).map((phrase) => phrase.toLowerCase());
  if (!phrases.length) return {};
  const result: Partial<Record<string, number>> = {};
  for (const [key, needle] of Object.entries(statNeedles))
    if (phrases.some((phrase) => phrase.includes(needle))) result[key] = 2;
  return result;
}

export function deriveDamageTags(build: BuildFitProfile): string[] {
  return build.damageTypes;
}

export function deriveCritical(build: BuildFitProfile): boolean {
  return /critical/i.test(build.offensiveStats.join(' '));
}
