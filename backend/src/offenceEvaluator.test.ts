import { describe, expect, it } from 'vitest';
import { applyConversions, evaluateOffence } from './offenceEvaluator.js';
import { findSkillMechanicProfile, skillMechanicProfileSchema } from './skillMechanicProfiles.js';

const scenario = {
  contentTarget: 'bossing' as const,
  targetRarity: 'unique' as const,
  durationSeconds: 10,
  movementShare: 0,
  hitChance: 1,
  manaRecoveryPerSecond: 200,
};
const bow = {
  itemType: 'Bow',
  itemClass: 'Bows',
  baseType: 'Gemini Bow',
  rarity: 'rare',
  customMods: [],
  physicalDamageMin: 100,
  physicalDamageMax: 100,
  attacksPerSecond: 1,
  rawText: '',
} as any;

describe('versioned offence evaluator', () => {
  it('validates all built-in profiles', () => {
    for (const name of ['Ice Shot', 'Spark', 'Explosive Shot'])
      expect(skillMechanicProfileSchema.safeParse(findSkillMechanicProfile(name)).success).toBe(true);
  });
  it('normalizes overconversion instead of creating damage', () => {
    const result = applyConversions({ physical: 100, fire: 0, cold: 0, lightning: 0, chaos: 0 }, [
      { from: 'physical', to: 'cold', percent: 100, kind: 'convert', scope: 'external' },
      { from: 'physical', to: 'fire', percent: 50, kind: 'convert', scope: 'external' },
    ]);
    expect(result.physical).toBe(0);
    expect(result.cold).toBeCloseTo(66.666);
    expect(result.fire).toBeCloseTo(33.333);
  });
  it('computes a gain-as-extra conversion from the damage pool as it stands after prior-scope conversions, not the pre-conversion pool', () => {
    const result = applyConversions({ physical: 100, fire: 0, cold: 0, lightning: 0, chaos: 0 }, [
      { from: 'physical', to: 'cold', percent: 80, kind: 'convert', scope: 'skill-inherent' },
      { from: 'physical', to: 'chaos', percent: 50, kind: 'gain-as-extra', scope: 'external' },
    ]);
    // Only 20 physical remains once the skill-inherent 80% conversion to cold has already run,
    // so the external "gain 50% of physical as extra chaos" should read from that 20, not the
    // original 100 — chaos = 20 * 0.5 = 10, not 50.
    expect(result.physical).toBeCloseTo(20);
    expect(result.cold).toBeCloseTo(80);
    expect(result.chaos).toBeCloseTo(10);
  });
  it('applies a skill-inherent gain-as-extra rule before any external-scope conversion runs', () => {
    const result = applyConversions({ physical: 100, fire: 0, cold: 0, lightning: 0, chaos: 0 }, [
      { from: 'physical', to: 'chaos', percent: 50, kind: 'gain-as-extra', scope: 'skill-inherent' },
      { from: 'physical', to: 'cold', percent: 100, kind: 'convert', scope: 'external' },
    ]);
    // The skill-inherent gain runs against the full 100 physical before the external conversion
    // consumes it, so chaos = 100 * 0.5 = 50, and physical is then fully converted to cold.
    expect(result.chaos).toBeCloseTo(50);
    expect(result.physical).toBeCloseTo(0);
    expect(result.cold).toBeCloseTo(100);
  });
  it('discloses the assumed skill gem level instead of silently presenting level-20 figures as universal', () => {
    const result = evaluateOffence(findSkillMechanicProfile('Ice Shot'), bow, scenario);
    expect(result.assumptions.some((line) => /level 20/i.test(line))).toBe(true);
  });
  it('does not turn Ice Shot shard count into boss shotgun DPS', () => {
    const result = evaluateOffence(findSkillMechanicProfile('Ice Shot'), bow, scenario);
    expect(result.sustainedDps).toBeNull();
    expect(result.mechanicCoverage.exactDpsAvailable).toBe(false);
    expect(result.mechanicCoverage.ignored).toContain('Secondary shards');
  });
  it('withholds Spark DPS without verified hits per cast', () => {
    const result = evaluateOffence(findSkillMechanicProfile('Spark'), { ...bow, itemType: 'Staff' }, scenario);
    expect(result.sustainedDps).toBeNull();
    expect(result.missingInputs).toContain('verified secondary-hit geometry');
  });
  it('models reload but withholds Explosive Shot damage when effectiveness is unknown', () => {
    const result = evaluateOffence(
      findSkillMechanicProfile('Explosive Shot'),
      { ...bow, itemType: 'Crossbow', rawText: 'Reload Time: 0.80' },
      scenario,
    );
    expect(result.resourceBalance.costPerSecond).not.toBeNull();
    expect(result.sustainedDps).toBeNull();
  });
  it('returns an explicit patch mismatch instead of reusing stale mechanics', () => {
    const result = evaluateOffence(findSkillMechanicProfile('Ice Shot'), bow, scenario, '0.6.0');
    expect(result.patchCompatibility).toBe('unsupported');
    expect(result.mechanicCoverage.exactDpsAvailable).toBe(false);
  });
  it('never applies hit-only penetration to ailment output', () => {
    const result = evaluateOffence(findSkillMechanicProfile('Ice Shot'), bow, scenario);
    expect(result.ailmentDps).toBeNull();
  });
});
