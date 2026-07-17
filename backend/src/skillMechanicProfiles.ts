import { z } from 'zod';
import type { DatabaseSync } from 'node:sqlite';
import type { SkillMechanicProfile } from './offenceTypes.js';

const source = (label: string, url: string, limitation?: string) => ({
  label,
  url,
  patch: '0.5.x',
  dataVersion: 'wiki-2026-07-14',
  confidence: 'High' as const,
  inspectedAt: '2026-07-14',
  limitation,
});

export const builtInSkillMechanicProfiles: SkillMechanicProfile[] = [
  {
    id: 'ice-shot:20',
    name: 'Ice Shot',
    patch: '0.5.x',
    dataVersion: '2026-07-14.1',
    source: 'poe2wiki',
    confidence: 'High',
    limitations: [
      'Secondary shard single-target overlap depends on geometry and is not included in exact DPS.',
      'External supports and conditional buffs require an explicit scenario.',
    ],
    level: 20,
    tags: ['attack', 'projectile', 'cold', 'repeatable'],
    weaponRequirements: ['bow'],
    use: { kind: 'attack', multiplier: 0.9 },
    cost: { resource: 'mana', amount: 40, paid: 'use' },
    components: [
      {
        id: 'arrow',
        label: 'Primary arrow',
        kind: 'attack-hit',
        damageTypes: ['physical', 'cold'],
        attackDamagePercent: 344,
        knownSingleTargetHits: 1,
      },
      {
        id: 'shards',
        label: 'Secondary shards',
        kind: 'secondary',
        damageTypes: ['cold'],
        attackDamagePercent: 344,
        knownSingleTargetHits: null,
        limitation: 'The cone targets other enemies; overlap with the primary target is not guaranteed.',
      },
    ],
    conversions: [{ from: 'physical', to: 'cold', percent: 80, kind: 'convert', scope: 'skill-inherent' }],
    projectilePolicy: {
      mode: 'simultaneous',
      sameTarget: 'one',
      secondaryGeometryKnown: false,
      clearCoverageOnlyProjectiles: true,
    },
    sources: [source('PoE2 Wiki — Ice Shot', 'https://www.poe2wiki.net/wiki/Ice_Shot')],
  },
  {
    id: 'spark:20',
    name: 'Spark',
    patch: '0.5.x',
    dataVersion: '2026-07-14.1',
    source: 'poe2wiki',
    confidence: 'High',
    limitations: [
      'Terrain and projectile travel make hits per cast scenario-dependent.',
      'Cold Infusion is a separate component and is not assumed active.',
    ],
    level: 20,
    tags: ['spell', 'projectile', 'lightning', 'duration'],
    weaponRequirements: [],
    use: { kind: 'spell', multiplier: 1, baseSeconds: 0.7 },
    cost: { resource: 'mana', amount: 56, paid: 'use' },
    components: [
      {
        id: 'base',
        label: 'Base Spark projectile',
        kind: 'spell-hit',
        damageTypes: ['lightning'],
        baseDamage: { lightning: { min: 11, max: 216 } },
        knownSingleTargetHits: null,
        limitation: 'Projectiles from the same cast are interval-limited to one hit per 0.66 seconds.',
      },
    ],
    conversions: [],
    projectilePolicy: {
      mode: 'simultaneous',
      sameTarget: 'interval-limited',
      intervalSeconds: 0.66,
      secondaryGeometryKnown: false,
      clearCoverageOnlyProjectiles: true,
    },
    sources: [source('PoE2 Wiki — Spark', 'https://www.poe2wiki.net/wiki/Spark')],
  },
  {
    id: 'explosive-shot:20',
    name: 'Explosive Shot',
    patch: '0.5.x',
    dataVersion: '2026-07-14.1',
    source: 'poe2wiki',
    confidence: 'Medium',
    limitations: [
      'The current reference does not publish an attack-damage multiplier for the explosion.',
      'Grenade detonations are separate skills and are not attributed to the bolt.',
    ],
    level: 20,
    tags: ['attack', 'aoe', 'ammunition', 'projectile', 'fire', 'detonator'],
    weaponRequirements: ['crossbow'],
    use: { kind: 'ammunition', multiplier: 1 },
    cost: { resource: 'mana', amount: 64, paid: 'reload' },
    reload: { baseSecondsFromWeapon: true, bolts: 1, speedMultiplier: 0.7 },
    components: [
      {
        id: 'explosion',
        label: 'Bolt explosion',
        kind: 'attack-hit',
        damageTypes: ['physical', 'fire'],
        knownSingleTargetHits: 1,
        limitation: 'Damage effectiveness is absent from the compatible reference.',
      },
    ],
    conversions: [],
    projectilePolicy: {
      mode: 'single',
      sameTarget: 'one',
      secondaryGeometryKnown: true,
      clearCoverageOnlyProjectiles: false,
    },
    sources: [
      source(
        'PoE2 Wiki — Explosive Shot',
        'https://www.poe2wiki.net/wiki/Explosive_Shot',
        'Attack damage multiplier is not listed.',
      ),
    ],
  },
];

export const skillMechanicProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  patch: z.string().min(1),
  dataVersion: z.string().min(1),
  source: z.string().min(1),
  confidence: z.enum(['High', 'Medium', 'Low']),
  limitations: z.array(z.string()),
  level: z.number().int().min(1).max(40),
  tags: z.array(z.string()),
  weaponRequirements: z.array(z.string()),
  use: z.object({
    kind: z.enum(['attack', 'spell', 'ammunition']),
    multiplier: z.number().positive(),
    baseSeconds: z.number().positive().optional(),
  }),
  cost: z.object({
    resource: z.enum(['mana', 'life', 'energy-shield']),
    amount: z.number().nonnegative(),
    paid: z.enum(['use', 'reload']),
  }),
  reload: z
    .object({
      baseSecondsFromWeapon: z.literal(true),
      bolts: z.number().int().positive(),
      speedMultiplier: z.number().positive(),
    })
    .optional(),
  components: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: z.enum(['attack-hit', 'spell-hit', 'ailment', 'secondary']),
      damageTypes: z.array(z.enum(['physical', 'fire', 'cold', 'lightning', 'chaos'])),
      attackDamagePercent: z.number().positive().optional(),
      baseDamage: z.record(z.object({ min: z.number(), max: z.number() })).optional(),
      knownSingleTargetHits: z.number().nonnegative().nullable(),
      limitation: z.string().optional(),
    }),
  ),
  conversions: z.array(
    z.object({
      from: z.enum(['physical', 'fire', 'cold', 'lightning', 'chaos']),
      to: z.enum(['physical', 'fire', 'cold', 'lightning', 'chaos']),
      percent: z.number().min(0),
      kind: z.enum(['convert', 'gain-as-extra']),
      scope: z.enum(['skill-inherent', 'external']),
    }),
  ),
  projectilePolicy: z.object({
    mode: z.enum(['single', 'simultaneous', 'sequential', 'unknown']),
    sameTarget: z.enum(['one', 'all', 'interval-limited', 'unknown']),
    intervalSeconds: z.number().positive().optional(),
    secondaryGeometryKnown: z.boolean(),
    clearCoverageOnlyProjectiles: z.boolean(),
  }),
  sources: z.array(
    z.object({
      label: z.string(),
      url: z.string().url(),
      patch: z.string(),
      dataVersion: z.string(),
      confidence: z.enum(['High', 'Medium', 'Low']),
      inspectedAt: z.string(),
      limitation: z.string().optional(),
    }),
  ),
});

export function findSkillMechanicProfile(mainSkill: string, patch = '0.5.x') {
  const normalized = mainSkill.trim().toLowerCase();
  return builtInSkillMechanicProfiles.find(
    (profile) => profile.name.toLowerCase() === normalized && (patch === profile.patch || patch.startsWith('0.5')),
  );
}

export function loadActiveSkillMechanicProfile(db: DatabaseSync, mainSkill: string, patch = '0.5.x') {
  const normalized = mainSkill.trim().toLowerCase();
  const active = db
    .prepare(
      "SELECT patch,data_version AS dataVersion,source FROM catalog_versions WHERE dataset='skills' AND status='active' ORDER BY activated_at DESC,id DESC LIMIT 1",
    )
    .get() as { patch: string; dataVersion: string; source: string } | undefined;
  if (!active || !(patch === active.patch || (patch.startsWith('0.5') && active.patch === '0.5.x'))) return undefined;
  const rows = db
    .prepare('SELECT profile_json AS profileJson FROM skill_profiles WHERE patch=? AND data_version=? AND source=?')
    .all(active.patch, active.dataVersion, active.source) as Array<{ profileJson: string }>;
  for (const row of rows) {
    try {
      const parsed = skillMechanicProfileSchema.safeParse(JSON.parse(row.profileJson));
      if (parsed.success && parsed.data.name.toLowerCase() === normalized) return parsed.data as SkillMechanicProfile;
    } catch {
      /* invalid staged data never becomes a runtime fact */
    }
  }
  return undefined;
}
