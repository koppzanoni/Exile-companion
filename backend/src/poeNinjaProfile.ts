import { z } from 'zod';

const profileUrl = /^https:\/\/poe\.ninja\/poe2\/profile\/([^/]+)\/([^/]+)\/character\/([^/?#]+)\/?$/i;
const gemSchema = z
  .object({
    name: z.string(),
    level: z.number().optional(),
    itemData: z
      .object({
        support: z.boolean().optional(),
        icon: z.string().url().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
const modelSchema = z.object({
  type: z.literal('found'),
  charModel: z
    .object({
      account: z.string().optional(),
      name: z.string(),
      league: z.string(),
      level: z.number(),
      class: z.string(),
      updatedUtc: z.string().optional(),
      defensiveStats: z.record(z.unknown()).optional(),
      passiveSelection: z.array(z.number()).optional(),
      passiveCounts: z
        .object({
          passives: z.number().optional(),
          anoints: z.number().optional(),
          ascendancy: z.number().optional(),
          bonusPassives: z.number().optional(),
        })
        .optional(),
      passiveTreeName: z.string().optional(),
      keystones: z.union([z.array(z.unknown()), z.record(z.unknown())]).optional(),
      questStats: z.array(z.string()).optional(),
      skills: z
        .array(
          z
            .object({
              allGems: z.array(gemSchema),
              dps: z.array(z.unknown()).optional(),
            })
            .passthrough(),
        )
        .optional(),
      items: z.array(z.record(z.unknown())).optional(),
    })
    .passthrough(),
});

export interface PoeNinjaCharacterProfile {
  source: 'poe.ninja-public-profile';
  sourceUrl: string;
  importedAt: string;
  updatedAt: string | null;
  identity: {
    account: string;
    name: string;
    league: string;
    level: number;
    className: string;
    ascendancy: string;
  };
  stats: Record<string, number | null>;
  passives: {
    allocated: number;
    anoints: number;
    ascendancyPoints: number;
    bonusPassives: number;
    treeVersion: string;
    nodeIds: number[];
  };
  keystones: Array<{ name: string; icon?: string; stats: string[] }>;
  questRewards: { claimed: string[]; missingCount: null; coverageNote: string };
  skills: Array<{
    name: string;
    level: number | null;
    icon?: string;
    supports: Array<{ name: string; level: number | null; icon?: string }>;
    reportedDps: Array<{ label: string; value: number }>;
  }>;
  equipment: Array<{
    slot: string;
    name: string;
    baseType: string;
    rarity: string;
    icon?: string;
    itemLevel: number | null;
    sockets: string[];
    requirements: string[];
    modifiers: string[];
  }>;
  equipmentCount: number;
  provenance: {
    publicProfile: boolean;
    confidence: 'High';
    limitations: string[];
  };
}

function clean(value: string) {
  return value
    .replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const classByAscendancy = new Map<string, string>(
  Object.entries({
    Warrior: ['Titan', 'Warbringer', 'Smith of Kitava'],
    Ranger: ['Deadeye', 'Pathfinder'],
    Sorceress: ['Stormweaver', 'Chronomancer', 'Disciple of Varashta'],
    Monk: ['Invoker', 'Acolyte of Chayula'],
    Mercenary: ['Witchhunter', 'Gemling Legionnaire', 'Tactician'],
    Witch: ['Infernalist', 'Blood Mage', 'Lich'],
    Huntress: ['Amazon', 'Ritualist'],
    Druid: ['Shaman', 'Oracle', 'Spirit Walker'],
  }).flatMap(([className, names]) => names.map((name) => [name, className] as const)),
);
async function profileVersion(account: string, league: string, character: string) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://poe.ninja/poe2/api/events/character/${encodeURIComponent(account)}/${encodeURIComponent(league)}/${encodeURIComponent(character)}`,
      { headers: { accept: 'text/event-stream' }, signal: controller.signal },
    );
    if (!response.ok || !response.body) throw new Error(`poe.ninja version lookup failed (${response.status}).`);
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let text = '';
    while (text.length < 4096) {
      const { done, value } = await reader.read();
      if (value) text += decoder.decode(value, { stream: !done });
      const match = text.match(/data:\s*(\{[^\n]+\})/);
      if (match) {
        await reader.cancel();
        const parsed = z.object({ version: z.number().int().nonnegative() }).parse(JSON.parse(match[1]));
        return parsed.version;
      }
      if (done) break;
    }
    throw new Error('poe.ninja did not return a character version.');
  } finally {
    clearTimeout(timer);
  }
}

export function parsePoeNinjaProfileUrl(url: string) {
  const match = url.trim().match(profileUrl);
  if (!match) throw new Error('Use a public poe.ninja PoE 2 character URL.');
  return {
    account: decodeURIComponent(match[1]),
    league: decodeURIComponent(match[2]),
    character: decodeURIComponent(match[3]),
    url: url.trim(),
  };
}

export async function fetchPoeNinjaProfile(url: string): Promise<PoeNinjaCharacterProfile> {
  const target = parsePoeNinjaProfileUrl(url),
    version = await profileVersion(target.account, target.league, target.character);
  const response = await fetch(
    `https://poe.ninja/poe2/api/profile/characters/${encodeURIComponent(target.account)}/${encodeURIComponent(target.league)}/${encodeURIComponent(target.character)}/model/${version}`,
    { headers: { accept: 'application/json' } },
  );
  if (!response.ok) throw new Error(`poe.ninja profile lookup failed (${response.status}).`);
  const parsed = modelSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('poe.ninja returned an unsupported profile format.');
  const model = parsed.data.charModel,
    def = model.defensiveStats || {};
  const number = (key: string) => (typeof def[key] === 'number' ? (def[key] as number) : null);
  const rawKeystones = Array.isArray(model.keystones) ? model.keystones : model.keystones ? [model.keystones] : [];
  const keystones = rawKeystones.flatMap((value) => {
    const result = z
      .object({
        name: z.string(),
        icon: z.string().optional(),
        stats: z.union([z.array(z.string()), z.string()]).optional(),
      })
      .passthrough()
      .safeParse(value);
    return result.success
      ? [
          {
            name: result.data.name,
            icon: result.data.icon,
            stats: (Array.isArray(result.data.stats) ? result.data.stats : [result.data.stats || ''])
              .filter(Boolean)
              .map(clean),
          },
        ]
      : [];
  });
  const skills = (model.skills || []).flatMap((group) => {
    const main = group.allGems.find((gem) => !gem.itemData?.support);
    if (!main) return [];
    return [
      {
        name: main.name,
        level: main.level ?? null,
        icon: main.itemData?.icon,
        supports: group.allGems
          .filter((gem) => gem !== main && Boolean(gem.itemData?.support))
          .map((gem) => ({
            name: gem.name,
            level: gem.level ?? null,
            icon: gem.itemData?.icon,
          })),
        reportedDps: (group.dps || []).flatMap((entry, index) => {
          if (typeof entry === 'number' && Number.isFinite(entry))
            return [{ label: index === 0 ? 'Reported DPS' : `Reported DPS ${index + 1}`, value: entry }];
          if (!entry || typeof entry !== 'object') return [];
          const row = entry as Record<string, unknown>,
            value = [row.value, row.dps, row.amount].find((x) => typeof x === 'number') as number | undefined;
          return value === undefined
            ? []
            : [{ label: String(row.label || row.name || `Reported DPS ${index + 1}`), value }];
        }),
      },
    ];
  });
  const textList = (value: unknown) =>
    Array.isArray(value)
      ? value.flatMap((entry) =>
          typeof entry === 'string'
            ? [clean(entry)]
            : entry && typeof entry === 'object' && typeof (entry as any).name === 'string'
              ? [clean(String((entry as any).name))]
              : [],
        )
      : [];
  const equipment = (model.items || []).map((wrapper, index) => {
    const raw = (
      wrapper.item && typeof wrapper.item === 'object'
        ? wrapper.item
        : wrapper.itemData && typeof wrapper.itemData === 'object'
          ? wrapper.itemData
          : wrapper
    ) as Record<string, unknown>;
    const properties = Array.isArray(raw.properties) ? raw.properties : [],
      requirements = Array.isArray(raw.requirements) ? raw.requirements : [];
    return {
      slot: String(wrapper.inventoryId || wrapper.slot || raw.inventoryId || `Item ${index + 1}`),
      name: String(raw.name || ''),
      baseType: String(raw.typeLine || raw.baseType || raw.type || 'Unknown item'),
      rarity: String(raw.rarity || raw.frameType || 'unknown'),
      icon: typeof raw.icon === 'string' ? raw.icon : undefined,
      itemLevel: typeof raw.ilvl === 'number' ? raw.ilvl : typeof raw.itemLevel === 'number' ? raw.itemLevel : null,
      sockets: textList(raw.sockets),
      requirements: requirements.flatMap((value) =>
        value && typeof value === 'object'
          ? [
              `${String((value as any).name || 'Requirement')}: ${String((value as any).values?.[0]?.[0] || (value as any).value || '')}`,
            ]
          : [],
      ),
      modifiers: [
        ...textList(raw.implicitMods),
        ...textList(raw.explicitMods),
        ...textList(raw.enchantMods),
        ...textList(raw.craftedMods),
        ...properties.flatMap((value) =>
          value && typeof value === 'object' && typeof (value as any).name === 'string'
            ? [clean(String((value as any).name))]
            : [],
        ),
      ],
    };
  });
  return {
    source: 'poe.ninja-public-profile',
    sourceUrl: target.url,
    importedAt: new Date().toISOString(),
    updatedAt: model.updatedUtc || null,
    identity: {
      account: model.account || target.account,
      name: model.name,
      league: model.league,
      level: model.level,
      className: classByAscendancy.get(model.class) || '',
      ascendancy: model.class,
    },
    stats: {
      life: number('life'),
      energyShield: number('energyShield'),
      mana: number('mana'),
      spirit: number('spirit'),
      armour: number('armour'),
      evasion: number('evasionRating'),
      movementSpeed: number('movementSpeed'),
      strength: number('strength'),
      dexterity: number('dexterity'),
      intelligence: number('intelligence'),
      fireResistance: number('fireResistance'),
      coldResistance: number('coldResistance'),
      lightningResistance: number('lightningResistance'),
      chaosResistance: number('chaosResistance'),
      effectiveHealthPool: number('effectiveHealthPool'),
    },
    passives: {
      allocated: model.passiveCounts?.passives ?? model.passiveSelection?.length ?? 0,
      anoints: model.passiveCounts?.anoints ?? 0,
      ascendancyPoints: model.passiveCounts?.ascendancy ?? 0,
      bonusPassives: model.passiveCounts?.bonusPassives ?? 0,
      treeVersion: model.passiveTreeName || 'unknown',
      nodeIds: model.passiveSelection || [],
    },
    keystones,
    questRewards: {
      claimed: (model.questStats || []).map(clean),
      missingCount: null,
      coverageNote:
        'Claimed rewards come from the public profile. Missing choices require a patch-specific quest catalog and are not guessed.',
    },
    skills,
    equipment,
    equipmentCount: model.items?.length || 0,
    provenance: {
      publicProfile: true,
      confidence: 'High',
      limitations: [
        'poe.ninja is an independent public data source, not the official GGG API.',
        'Quest rewards show confirmed claims only until a versioned quest catalog is available.',
        'Passive node ids are preserved; names and tree rendering depend on matching tree data for the reported version.',
      ],
    },
  };
}
