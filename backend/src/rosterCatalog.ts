import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AppDatabase } from './db.js';

export const rosterEntrySchema = z.object({
  baseClass: z.string().min(1),
  playable: z.boolean(),
  planned: z.boolean().default(false),
  ascendancies: z.array(z.object({ name: z.string().min(1), alternate: z.boolean().default(false) })),
});
export const rosterCatalogSchema = z.object({
  patch: z.string().min(1),
  dataVersion: z.string().min(1),
  source: z.string().url(),
  verifiedAt: z.string().datetime(),
  confidence: z.enum(['High', 'Medium', 'Low']),
  limitations: z.array(z.string()),
  compatibility: z.object({ min: z.string(), max: z.string() }),
  entries: z.array(rosterEntrySchema).min(1),
});
export type RosterCatalog = z.infer<typeof rosterCatalogSchema>;

export const builtInRosterCatalog: RosterCatalog = {
  patch: '0.5.4b',
  dataVersion: '2026-07-15.1',
  source: 'https://www.pathofexile.com/forum/view-forum/2212',
  verifiedAt: '2026-07-15T17:00:00.000Z',
  confidence: 'High',
  limitations: [
    'Hotfixes can change mechanics without changing the base roster.',
    'Abyssal Lich is an alternate ascendancy and is not counted among the 22 regular choices.',
  ],
  compatibility: { min: '0.5.4b', max: '0.5.4b' },
  entries: [
    {
      baseClass: 'Warrior',
      playable: true,
      planned: false,
      ascendancies: [
        { name: 'Titan', alternate: false },
        { name: 'Warbringer', alternate: false },
        { name: 'Smith of Kitava', alternate: false },
      ],
    },
    {
      baseClass: 'Ranger',
      playable: true,
      planned: false,
      ascendancies: [
        { name: 'Deadeye', alternate: false },
        { name: 'Pathfinder', alternate: false },
      ],
    },
    {
      baseClass: 'Huntress',
      playable: true,
      planned: false,
      ascendancies: [
        { name: 'Amazon', alternate: false },
        { name: 'Ritualist', alternate: false },
        { name: 'Spirit Walker', alternate: false },
      ],
    },
    {
      baseClass: 'Mercenary',
      playable: true,
      planned: false,
      ascendancies: [
        { name: 'Witchhunter', alternate: false },
        { name: 'Gemling Legionnaire', alternate: false },
        { name: 'Tactician', alternate: false },
      ],
    },
    {
      baseClass: 'Monk',
      playable: true,
      planned: false,
      ascendancies: [
        { name: 'Invoker', alternate: false },
        { name: 'Acolyte of Chayula', alternate: false },
        { name: 'Martial Artist', alternate: false },
      ],
    },
    {
      baseClass: 'Witch',
      playable: true,
      planned: false,
      ascendancies: [
        { name: 'Infernalist', alternate: false },
        { name: 'Blood Mage', alternate: false },
        { name: 'Lich', alternate: false },
        { name: 'Abyssal Lich', alternate: true },
      ],
    },
    {
      baseClass: 'Sorceress',
      playable: true,
      planned: false,
      ascendancies: [
        { name: 'Stormweaver', alternate: false },
        { name: 'Chronomancer', alternate: false },
        { name: 'Disciple of Varashta', alternate: false },
      ],
    },
    {
      baseClass: 'Druid',
      playable: true,
      planned: false,
      ascendancies: [
        { name: 'Shaman', alternate: false },
        { name: 'Oracle', alternate: false },
      ],
    },
    ...['Marauder', 'Duelist', 'Shadow', 'Templar'].map((baseClass) => ({
      baseClass,
      playable: false,
      planned: true,
      ascendancies: [],
    })),
  ],
};

export function validateRosterCatalog(value: unknown) {
  const parsed = rosterCatalogSchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, errors: parsed.error.issues.map((issue) => issue.message) };
  const catalog = parsed.data;
  const errors: string[] = [];
  const playable = catalog.entries.filter((entry) => entry.playable);
  const regular = playable.flatMap((entry) => entry.ascendancies).filter((entry) => !entry.alternate);
  if (playable.length !== 8) errors.push(`Expected 8 playable classes; received ${playable.length}.`);
  if (regular.length !== 22) errors.push(`Expected 22 regular ascendancies; received ${regular.length}.`);
  const owner = (name: string) =>
    playable.find((entry) => entry.ascendancies.some((asc) => asc.name === name))?.baseClass;
  if (owner('Spirit Walker') !== 'Huntress') errors.push('Spirit Walker must belong to Huntress.');
  if (owner('Martial Artist') !== 'Monk') errors.push('Martial Artist must belong to Monk.');
  if (
    !playable.some(
      (entry) =>
        entry.baseClass === 'Witch' && entry.ascendancies.some((asc) => asc.name === 'Abyssal Lich' && asc.alternate),
    )
  )
    errors.push('Abyssal Lich must be an alternate Witch ascendancy.');
  return errors.length
    ? { ok: false as const, errors }
    : { ok: true as const, catalog, checksum: createHash('sha256').update(JSON.stringify(catalog)).digest('hex') };
}

export function patchCompatibility(catalog: RosterCatalog, patch?: string) {
  if (!patch) return 'unknown' as const;
  return patch === catalog.patch || patch.startsWith(`${catalog.patch} `)
    ? ('exact' as const)
    : ('unsupported' as const);
}

export function loadActiveRosterCatalog(db: AppDatabase): {
  catalog: RosterCatalog;
  status: 'active' | 'fallback';
  checksum: string;
} {
  const row = db
    .prepare(
      "SELECT r.payload_json AS payloadJson,r.checksum FROM roster_catalogs r JOIN catalog_versions c ON c.dataset='roster' AND c.patch=r.patch AND c.data_version=r.data_version AND c.source=r.source WHERE c.status='active' ORDER BY c.activated_at DESC,c.id DESC LIMIT 1",
    )
    .get() as { payloadJson: string; checksum: string } | undefined;
  if (row) {
    const parsed = validateRosterCatalog(JSON.parse(row.payloadJson));
    if (parsed.ok) return { catalog: parsed.catalog, status: 'active', checksum: row.checksum };
  }
  const fallback = validateRosterCatalog(builtInRosterCatalog);
  if (!fallback.ok) throw new Error(fallback.errors.join(' '));
  return { catalog: fallback.catalog, status: 'fallback', checksum: fallback.checksum };
}

export function rosterCompatibility(catalog: RosterCatalog, className?: string, ascendancy?: string, patch?: string) {
  const entry = catalog.entries.find((value) => value.baseClass === className);
  const issues: string[] = [];
  if (className && !entry) issues.push(`Class '${className}' is unknown to this catalog.`);
  if (entry && !entry.playable) issues.push(`${entry.baseClass} is planned but unavailable in ${catalog.patch}.`);
  if (entry && ascendancy && !entry.ascendancies.some((value) => value.name === ascendancy))
    issues.push(`${ascendancy} is not catalogued for ${entry.baseClass}.`);
  const patchStatus = patchCompatibility(catalog, patch);
  if (patchStatus === 'unsupported') issues.push(`Roster catalog ${catalog.patch} cannot verify patch ${patch}.`);
  return {
    recognized: Boolean(
      entry && entry.playable && (!ascendancy || entry.ascendancies.some((value) => value.name === ascendancy)),
    ),
    patchCompatibility: patchStatus,
    issues,
  };
}
