import type { ItemStats, Listing, ParsedTradeQuery, Rarity } from './types.js';
import { detectItemCategory } from './categoryDetection.js';

export const BASE = 'https://www.pathofexile.com';

export function decodeTradeQuery(value: string): Record<string, unknown> | null {
  const candidates = [value];
  try {
    candidates.push(decodeURIComponent(value));
  } catch {
    /* ignored */
  }
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    candidates.push(Buffer.from(normalized, 'base64').toString('utf8'));
  } catch {
    /* ignored */
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function parseTradeUrl(input: string): ParsedTradeQuery {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Enter a valid official Trade2 URL.');
  }
  if (url.hostname !== 'www.pathofexile.com' && url.hostname !== 'pathofexile.com')
    throw new Error('URL must use pathofexile.com.');
  const parts = url.pathname.split('/').filter(Boolean);
  const searchIndex = parts.indexOf('search');
  if (searchIndex < 0 || parts[searchIndex + 1] !== 'poe2')
    throw new Error('URL must be a Path of Exile 2 Trade search URL.');
  const league = decodeURIComponent(parts[searchIndex + 2] || 'Runes of Aldur');
  const tail = parts[searchIndex + 3];
  const q = url.searchParams.get('q');
  const raw = q ? decodeTradeQuery(q) : null;
  const query = ((raw?.query as Record<string, unknown> | undefined) || raw || {}) as Record<string, unknown>;
  const filters = (query.filters as Record<string, unknown>) || {};
  const type =
    typeof query.type === 'string'
      ? query.type
      : nestedString(filters, ['type_filters', 'filters', 'base_type', 'option']);
  const rarity = nestedString(filters, ['type_filters', 'filters', 'rarity', 'option']);
  return {
    league,
    type,
    rarity,
    filters,
    stats: Array.isArray(query.stats) ? query.stats : [],
    sort: (raw?.sort as Record<string, unknown>) || { price: 'asc' },
    rawQuery: raw,
    queryId: !q && tail ? tail : undefined,
  };
}

function nestedString(value: unknown, path: string[]): string | undefined {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

export type TradeSearchMode = 'exact-base' | 'same-slot';

export interface TradeQueryOptions {
  toleranceScale?: number;
  onlyStats?: string[];
}

export function buildTradeQuery(
  item: ItemStats,
  mode: TradeSearchMode = 'exact-base',
  options: TradeQueryOptions = {},
) {
  const toleranceScale = options.toleranceScale ?? 1;
  const category = categoryFor(item);
  const detected = detectItemCategory(item).key;
  const isBroad = mode === 'same-slot';
  const isWeapon = [
    'bow',
    'crossbow',
    'one-handed-melee',
    'two-handed-melee',
    'quarterstaff',
    'staff',
    'wand',
    'sceptre',
  ].includes(detected);
  const isAttackWeapon = ['bow', 'crossbow', 'one-handed-melee', 'two-handed-melee', 'quarterstaff'].includes(detected);
  const physicalDps = averageDamage(item.physicalDamageMin, item.physicalDamageMax) * (item.attacksPerSecond || 1);
  const totalDps =
    physicalDps +
    (averageDamage(item.fireDamageMin, item.fireDamageMax) +
      averageDamage(item.coldDamageMin, item.coldDamageMax) +
      averageDamage(item.lightningDamageMin, item.lightningDamageMax) +
      averageDamage(item.chaosDamageMin, item.chaosDamageMax)) *
      (item.attacksPerSecond || 1);
  const filters: Record<string, unknown> = {
    type_filters: {
      filters: {
        category: isBroad && category ? { option: category } : undefined,
        rarity: { option: item.rarity === 'unknown' ? undefined : item.rarity },
        ilvl: isBroad ? minimumRange(item.itemLevel, 10 * toleranceScale) : range(item.itemLevel, 5 * toleranceScale),
      },
    },
    equipment_filters: {
      filters: {
        es: isBroad
          ? minimumRange(item.energyShield, proportional(item.energyShield) * toleranceScale)
          : range(item.energyShield, proportional(item.energyShield) * toleranceScale),
        ev: isBroad
          ? minimumRange(item.evasion, proportional(item.evasion) * toleranceScale)
          : range(item.evasion, proportional(item.evasion) * toleranceScale),
        ar: isBroad
          ? minimumRange(item.armour, proportional(item.armour) * toleranceScale)
          : range(item.armour, proportional(item.armour) * toleranceScale),
        dps:
          isAttackWeapon && totalDps
            ? minimumRange(totalDps, Math.max(10, totalDps * 0.2 * toleranceScale))
            : undefined,
        pdps:
          isAttackWeapon && physicalDps
            ? minimumRange(physicalDps, Math.max(10, physicalDps * 0.2 * toleranceScale))
            : undefined,
        aps: isAttackWeapon ? range(item.attacksPerSecond, 0.15 * toleranceScale) : undefined,
        crit: isAttackWeapon ? range(item.criticalHitChance, 0.75 * toleranceScale) : undefined,
      },
    },
    trade_filters: { filters: { price: { option: 'exalted_divine' } } },
  };
  const stats = isWeapon ? [] : statFilters(item, detected, options.onlyStats, toleranceScale);
  return {
    query: {
      status: { option: 'online' },
      type: isBroad ? undefined : item.baseType || item.itemType || undefined,
      stats: stats.length ? [{ type: 'and', filters: stats }] : [],
      filters,
    },
    sort: { price: 'asc' },
  };
}

function range(value?: number, tolerance = 5) {
  return value === undefined
    ? undefined
    : { min: Math.max(0, Math.floor(value - tolerance)), max: Math.ceil(value + tolerance * 2) };
}
function minimumRange(value?: number, tolerance = 5) {
  return value === undefined ? undefined : { min: Math.max(0, Math.floor(value - tolerance)) };
}
const proportional = (value?: number) => (value ? Math.max(5, value * 0.2) : 5);
const averageDamage = (min?: number, max?: number) => (min === undefined || max === undefined ? 0 : (min + max) / 2);

function categoryFor(item: ItemStats) {
  const key = detectItemCategory(item).key;
  const categories: Partial<Record<typeof key, string>> = {
    boots: 'armour.boots',
    helmet: 'armour.helmet',
    gloves: 'armour.gloves',
    'body-armour': 'armour.chest',
    shield: 'armour.shield',
    focus: 'armour.focus',
    quiver: 'armour.quiver',
    ring: 'accessory.ring',
    amulet: 'accessory.amulet',
    belt: 'accessory.belt',
    bow: 'weapon.bow',
    crossbow: 'weapon.crossbow',
    wand: 'weapon.wand',
    sceptre: 'weapon.sceptre',
    staff: 'weapon.staff',
    quarterstaff: 'weapon.quarterstaff',
  };
  const weaponClass = `${item.itemClass || ''} ${item.baseType}`.toLowerCase();
  if (key === 'one-handed-melee')
    return /axe/.test(weaponClass)
      ? 'weapon.oneaxe'
      : /mace/.test(weaponClass)
        ? 'weapon.onemace'
        : /sword/.test(weaponClass)
          ? 'weapon.onesword'
          : /dagger/.test(weaponClass)
            ? 'weapon.dagger'
            : /flail/.test(weaponClass)
              ? 'weapon.flail'
              : /spear/.test(weaponClass)
                ? 'weapon.spear'
                : undefined;
  if (key === 'two-handed-melee')
    return /axe/.test(weaponClass)
      ? 'weapon.twoaxe'
      : /mace|maul/.test(weaponClass)
        ? 'weapon.twomace'
        : /sword/.test(weaponClass)
          ? 'weapon.twosword'
          : undefined;
  return categories[key];
}

const statMap: Array<[keyof ItemStats, string, number]> = [
  ['life', 'pseudo.pseudo_total_life', 10],
  ['mana', 'pseudo.pseudo_total_mana', 12],
  ['fireResistance', 'pseudo.pseudo_total_fire_resistance', 8],
  ['coldResistance', 'pseudo.pseudo_total_cold_resistance', 8],
  ['lightningResistance', 'pseudo.pseudo_total_lightning_resistance', 8],
  ['chaosResistance', 'pseudo.pseudo_total_chaos_resistance', 8],
  ['movementSpeed', 'explicit.stat_2250533757', 5],
  ['spirit', 'pseudo.pseudo_total_spirit', 8],
];

function statFilters(
  item: ItemStats,
  category: ReturnType<typeof detectItemCategory>['key'],
  onlyStats?: string[],
  toleranceScale = 1,
) {
  const allowed =
    category === 'boots'
      ? new Set(['life', 'fireResistance', 'coldResistance', 'lightningResistance', 'chaosResistance', 'movementSpeed'])
      : category === 'quiver'
        ? new Set<string>()
        : category === 'shield'
          ? new Set(['life', 'fireResistance', 'coldResistance', 'lightningResistance', 'chaosResistance'])
          : new Set(statMap.map(([key]) => key));
  const restrict = onlyStats?.length ? new Set(onlyStats) : null;
  return statMap.flatMap(([key, id, tolerance]) => {
    if (!allowed.has(key)) return [];
    if (restrict && !restrict.has(key)) return [];
    const value = item[key];
    return typeof value === 'number'
      ? [{ id, value: { min: Math.max(0, value - tolerance * toleranceScale) }, disabled: false }]
      : [];
  });
}

export function buildTradeUrl(item: ItemStats, league: string) {
  return buildTradeUrlWithOptions(item, league);
}

export function buildTradeUrlWithOptions(
  item: ItemStats,
  league: string,
  mode: TradeSearchMode = 'exact-base',
  options: TradeQueryOptions = {},
) {
  const query = buildTradeQuery(item, mode, options);
  const q = Buffer.from(JSON.stringify(query)).toString('base64url');
  return `${BASE}/trade2/search/poe2/${encodeURIComponent(league)}?q=${q}`;
}

export async function postOfficialSearch(
  body: ReturnType<typeof buildTradeQuery>,
  league: string,
  signal: AbortSignal,
) {
  const response = await fetch(`${BASE}/api/trade2/search/poe2/${encodeURIComponent(league)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'poe2-orb-analyzer/1.0 (personal price verification)',
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(`Trade2 returned HTTP ${response.status}`);
  return response;
}

export function normalizeOfficialListing(value: unknown, divineRate: number, officialUrl: string): Listing | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, any>;
  const price = row.listing?.price;
  const amount = Number(price?.amount);
  const currencyRaw = String(price?.currency || '').toLowerCase();
  const currency = currencyRaw.includes('divine') ? 'divine' : currencyRaw.includes('exalted') ? 'exalted' : null;
  if (!Number.isFinite(amount) || amount <= 0 || !currency) return null;
  const item = row.item || {};
  const modLines = [...(item.explicitMods || []), ...(item.implicitMods || [])]
    .map((mod: unknown) =>
      typeof mod === 'string' ? mod : String((mod as Record<string, unknown>)?.description || ''),
    )
    .filter(Boolean);
  const text = modLines.join('\n');
  const stats = parseLooseStats(text);
  const properties = Array.isArray(item.properties) ? item.properties : [];
  return {
    id: String(row.id || crypto.randomUUID()),
    name: item.name || item.typeLine || 'Unnamed item',
    baseType: item.baseType || item.typeLine || '',
    rarity: String(item.rarity || 'unknown').toLowerCase() as Rarity,
    price: amount,
    currency,
    exaltedPrice: currency === 'divine' ? amount * divineRate : amount,
    stats: {
      ...stats,
      itemLevel: item.ilvl,
      energyShield: propertyNumber(properties, /Energy Shield/i),
      armour: propertyNumber(properties, /Armour/i),
      evasion: propertyNumber(properties, /Evasion/i),
      ...propertyRange(properties, /(?:\[Physical\]|Physical) Damage/i, 'physicalDamage'),
      ...propertyRange(properties, /Fire Damage/i, 'fireDamage'),
      ...propertyRange(properties, /Cold Damage/i, 'coldDamage'),
      ...propertyRange(properties, /Lightning Damage/i, 'lightningDamage'),
      ...propertyRange(properties, /Chaos Damage/i, 'chaosDamage'),
      ...elementalPropertyRanges(properties),
      attacksPerSecond: propertyNumber(properties, /Attacks per Second/i),
      criticalHitChance: propertyNumber(properties, /(?:\[Critical\|Critical Hit\]|Critical Hit) Chance/i),
      customMods: modLines,
    },
    account: row.listing?.account?.name,
    indexedAt: row.listing?.indexed,
    source: 'live',
    officialUrl,
  };
}

function propertyRange(
  properties: any[],
  pattern: RegExp,
  prefix: 'physicalDamage' | 'fireDamage' | 'coldDamage' | 'lightningDamage' | 'chaosDamage',
) {
  const property = properties.find((entry) => pattern.test(String(entry?.name || '')));
  const raw = String(property?.values?.[0]?.[0] || '');
  const match = raw.match(/([\d.]+)\s*-\s*([\d.]+)/);
  return match ? { [`${prefix}Min`]: Number(match[1]), [`${prefix}Max`]: Number(match[2]) } : {};
}

function elementalPropertyRanges(properties: any[]) {
  const property = properties.find(
    (entry) =>
      Number(entry?.type) === 10 ||
      /(?:\[ElementalDamage\|Elemental\]|Elemental) Damage/i.test(String(entry?.name || '')),
  );
  const result: Record<string, number> = {};
  const prefixes: Record<number, string> = { 4: 'fireDamage', 5: 'coldDamage', 6: 'lightningDamage', 7: 'chaosDamage' };
  for (const value of property?.values || []) {
    const match = String(value?.[0] || '').match(/([\d.]+)\s*-\s*([\d.]+)/);
    const prefix = prefixes[Number(value?.[1])];
    if (match && prefix) {
      result[`${prefix}Min`] = Number(match[1]);
      result[`${prefix}Max`] = Number(match[2]);
    }
  }
  return result;
}

function propertyNumber(properties: any[], pattern: RegExp) {
  const property = properties.find((entry) => pattern.test(String(entry?.name || '')));
  const raw = property?.values?.[0]?.[0];
  if (raw === undefined) return undefined;
  const value = Number(String(raw).replace(/[^\d.-]/g, ''));
  return Number.isFinite(value) ? value : undefined;
}

function parseLooseStats(text: string): Partial<ItemStats> {
  const find = (re: RegExp) => Number(text.match(re)?.[1]) || undefined;
  const addedDamage = (element: string): [number | undefined, number | undefined] => {
    const base = text.match(new RegExp(`${element} Damage:\\s*(\\d+(?:\\.\\d+)?)-(\\d+(?:\\.\\d+)?)`, 'i'));
    if (base) return [Number(base[1]), Number(base[2])];
    const added = text.match(
      new RegExp(`Adds (\\d+)(?:\\([^)]*\\))? to (\\d+)(?:\\([^)]*\\))? ${element} Damage`, 'i'),
    );
    return added ? [Number(added[1]), Number(added[2])] : [undefined, undefined];
  };
  const [physicalDamageMin, physicalDamageMax] = addedDamage('Physical');
  const [fireDamageMin, fireDamageMax] = addedDamage('Fire');
  const [coldDamageMin, coldDamageMax] = addedDamage('Cold');
  const [lightningDamageMin, lightningDamageMax] = addedDamage('Lightning');
  const [chaosDamageMin, chaosDamageMax] = addedDamage('Chaos');
  return {
    life: find(/\+(\d+) to maximum Life/i),
    mana: find(/\+(\d+) to maximum Mana/i),
    movementSpeed: find(/(\d+)% increased Movement Speed/i),
    fireResistance: find(/\+(\d+)% to Fire Resistance/i),
    coldResistance: find(/\+(\d+)% to Cold Resistance/i),
    lightningResistance: find(/\+(\d+)% to Lightning Resistance/i),
    chaosResistance: find(/\+(\d+)% to Chaos Resistance/i),
    intelligence: find(/\+(\d+) to Intelligence/i),
    strength: find(/\+(\d+) to Strength/i),
    dexterity: find(/\+(\d+) to Dexterity/i),
    spirit: find(/\+(\d+) to Spirit/i),
    rarityFind: find(/(\d+)% increased Rarity of Items found/i),
    physicalDamageMin,
    physicalDamageMax,
    fireDamageMin,
    fireDamageMax,
    coldDamageMin,
    coldDamageMax,
    lightningDamageMin,
    lightningDamageMax,
    chaosDamageMin,
    chaosDamageMax,
    attacksPerSecond: find(/Attacks per Second:\s*(\d+(?:\.\d+)?)/i),
    attackSpeedBonus: find(/(\d+)(?:\([^)]*\))?% increased Attack Speed/i),
    castSpeed: find(/(\d+)(?:\([^)]*\))?% increased Cast Speed/i),
    spellDamage: find(/(\d+)(?:\([^)]*\))?% increased Spell Damage/i),
    criticalHitChance: find(/Critical Hit Chance:\s*(\d+(?:\.\d+)?)%/i),
    criticalDamageBonus: find(/(\d+)(?:\([^)]*\))?% increased Critical Damage(?:\s+Bonus)?/i),
    blockChance: find(/(\d+)% Chance to Block/i),
    increasedBlockChance: find(/(\d+)(?:\([^)]*\))?% increased Block chance/i),
    armour: find(/Armour:\s*(\d+)/i),
    evasion: find(/Evasion Rating:\s*(\d+)/i),
    energyShield: find(/Energy Shield:\s*(\d+)/i),
    deflection: find(/Deflection:\s*(\d+)/i),
    runicWard: find(/Runic Ward:\s*(\d+)/i),
    stunThreshold: find(/\+(\d+) to Stun Threshold/i),
  };
}

export function parseManualListings(input: string, divineRate: number): Listing[] {
  if (!input.trim()) return [];
  try {
    const json = JSON.parse(input);
    const rows = Array.isArray(json) ? json : [json];
    return rows
      .map((row, index) => normalizeManualObject(row, index, divineRate))
      .filter((v): v is Listing => Boolean(v));
  } catch {
    /* parse simple lines */
  }
  return input
    .split('\n')
    .map((line, index): Listing | null => {
      const parts = line.split('|').map((part) => part.trim());
      const priceMatch = parts[0]?.match(/([\d.]+)\s*(divine|div|exalted|ex)/i);
      if (!priceMatch) return null;
      const currency: 'divine' | 'exalted' = /^div/i.test(priceMatch[2]) ? 'divine' : 'exalted';
      const price = Number(priceMatch[1]);
      const stats = parseLooseStats(parts.slice(2).join(' '));
      return {
        id: `manual-${index}`,
        name: parts[1] || 'Manual listing',
        baseType: parts[1] || '',
        rarity: 'unknown' as Rarity,
        price,
        currency,
        exaltedPrice: currency === 'divine' ? price * divineRate : price,
        stats,
        source: 'manual',
      };
    })
    .filter((v): v is Listing => Boolean(v));
}

export function dedupeListings(listings: Listing[]) {
  const unique = new Map<string, Listing>();
  for (const listing of listings) {
    const key =
      listing.id ||
      `${listing.account || 'unknown'}|${listing.name}|${listing.baseType}|${listing.price}|${listing.currency}`;
    if (!unique.has(key)) unique.set(key, listing);
  }
  return [...unique.values()];
}

function normalizeManualObject(row: any, index: number, divineRate: number): Listing | null {
  if (!row || !Number.isFinite(Number(row.price))) return null;
  const currency = String(row.currency || 'exalted')
    .toLowerCase()
    .startsWith('div')
    ? 'divine'
    : 'exalted';
  const price = Number(row.price);
  return {
    id: String(row.id || `manual-${index}`),
    name: String(row.name || row.baseType || 'Manual listing'),
    baseType: String(row.baseType || row.name || ''),
    rarity: String(row.rarity || 'unknown').toLowerCase() as Rarity,
    price,
    currency,
    exaltedPrice: currency === 'divine' ? price * divineRate : price,
    stats: row.stats || row,
    account: row.account,
    indexedAt: row.indexedAt,
    source: 'manual',
    officialUrl: row.officialUrl,
  };
}
