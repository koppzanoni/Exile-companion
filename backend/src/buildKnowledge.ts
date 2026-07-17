import type { BuildFitProfile } from './types.js';

export type KnowledgeConfidence = 'Low' | 'Medium' | 'High';
export interface LoadoutSkill {
  name: string;
  supports: string[];
  spiritReservation?: number;
  tags?: string[];
}
export interface CharacterBuildLoadout {
  patch: string;
  source: 'manual' | 'poe-api' | 'imported';
  confidence: KnowledgeConfidence;
  mainSkill: string;
  weaponSet: string;
  availableSpirit?: number;
  skills: LoadoutSkill[];
  keyPassives: string[];
}
export interface CharacterIdentity {
  className: string;
  ascendancy: string;
  buildProfileId?: string;
}

const norm = (value: string) => value.trim().toLowerCase();
export function analyzeLoadout(loadout: CharacterBuildLoadout) {
  const warnings: string[] = [];
  const dependencies: Array<{ from: string; to: string; kind: 'support' | 'weapon' | 'passive' | 'spirit' }> = [];
  const names = loadout.skills.map((skill) => norm(skill.name)).filter(Boolean);
  const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
  if (duplicates.length) warnings.push(`Duplicate skill entries: ${duplicates.join(', ')}.`);
  const main = loadout.skills.find((skill) => norm(skill.name) === norm(loadout.mainSkill));
  if (loadout.mainSkill && !main) warnings.push('The selected main skill is not present in the skill links.');
  if (main && !main.supports.length) warnings.push('The main skill has no supports recorded.');
  for (const skill of loadout.skills) {
    for (const support of skill.supports) dependencies.push({ from: skill.name, to: support, kind: 'support' });
    if (skill.spiritReservation)
      dependencies.push({ from: skill.name, to: `${skill.spiritReservation} Spirit`, kind: 'spirit' });
  }
  if (loadout.mainSkill && loadout.weaponSet)
    dependencies.push({ from: loadout.mainSkill, to: loadout.weaponSet, kind: 'weapon' });
  for (const passive of loadout.keyPassives)
    dependencies.push({ from: loadout.mainSkill || 'Build', to: passive, kind: 'passive' });
  const reservedSpirit = loadout.skills.reduce((sum, skill) => sum + (skill.spiritReservation || 0), 0);
  if (loadout.availableSpirit !== undefined && reservedSpirit > loadout.availableSpirit)
    warnings.push(`Recorded reservations exceed available Spirit by ${reservedSpirit - loadout.availableSpirit}.`);
  if (loadout.patch === 'unknown') warnings.push('Patch is unknown; mechanical conclusions may be outdated.');
  return {
    reservedSpirit,
    remainingSpirit: loadout.availableSpirit === undefined ? null : loadout.availableSpirit - reservedSpirit,
    dependencies,
    warnings,
  };
}

export function simulateLoadout(current: CharacterBuildLoadout, next: CharacterBuildLoadout) {
  const before = analyzeLoadout(current);
  const after = analyzeLoadout(next);
  const newWarnings = after.warnings.filter((warning) => !before.warnings.includes(warning));
  const resolvedWarnings = before.warnings.filter((warning) => !after.warnings.includes(warning));
  const spiritDelta = after.reservedSpirit - before.reservedSpirit;
  return {
    before,
    after,
    spiritDelta,
    newWarnings,
    resolvedWarnings,
    safe: newWarnings.length === 0 && (after.remainingSpirit === null || after.remainingSpirit >= 0),
    verdict: newWarnings.length
      ? 'Unsafe change'
      : spiritDelta > 0
        ? 'Valid, but uses more Spirit'
        : spiritDelta < 0
          ? 'Valid and frees Spirit'
          : 'No mechanical conflict detected',
  };
}

export function findSimilarBuilds(
  identity: CharacterIdentity,
  loadout: CharacterBuildLoadout,
  profiles: BuildFitProfile[],
) {
  const scored = profiles
    .map((profile) => {
      let score = 0;
      const reasons: string[] = [];
      if (norm(profile.className) === norm(identity.className)) {
        score += 25;
        reasons.push('same class');
      }
      if (identity.ascendancy && norm(profile.ascendancy || '') === norm(identity.ascendancy)) {
        score += 25;
        reasons.push('same ascendancy');
      }
      if (loadout.mainSkill && norm(profile.mainSkill) === norm(loadout.mainSkill)) {
        score += 35;
        reasons.push('same main skill');
      }
      if (
        loadout.weaponSet &&
        profile.preferredWeaponTypes.some((type) => norm(loadout.weaponSet).includes(norm(type)))
      ) {
        score += 15;
        reasons.push('compatible weapon');
      }
      return { profileId: profile.id, name: profile.name, score, reasons };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const sampleSize = profiles.length;
  const confidence: KnowledgeConfidence =
    loadout.confidence === 'High' && sampleSize >= 5 ? 'High' : sampleSize >= 3 ? 'Medium' : 'Low';
  return {
    matches: scored,
    sampleSize,
    confidence,
    limitation: 'Similarity uses configured local profiles, not global ladder or meta statistics.',
  };
}
