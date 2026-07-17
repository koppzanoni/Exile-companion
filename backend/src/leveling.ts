import type { BuildFitProfile } from './types.js';

const BASE = 'https://www.pathofexile.com';
export const TRADE2_MAX_FETCH_RESULTS = 10;

export type LevelingSlot = 'weapon' | 'body-armour' | 'boots' | 'helmet' | 'gloves' | 'ring' | 'amulet' | 'belt';
export type ProgressionMilestone = '10' | '20' | '30' | '40' | 'advanced-campaign' | 'early-endgame' | 'endgame';
export type LevelingVerdict = 'buy-now' | 'wait' | 'not-worth-it';

export interface LevelingListing {
  id: string;
  slot: LevelingSlot;
  name: string;
  baseType: string;
  requiredLevel?: number;
  price: number;
  currency: string;
  account?: string;
  mods: string[];
  officialUrl: string;
  verdict: LevelingVerdict;
  usefulLevels: number;
  waitUntilLevel?: number;
}

export interface LevelingSlotResult {
  slot: LevelingSlot;
  label: string;
  priorities: string[];
  budget: number;
  listings: LevelingListing[];
  officialUrl: string;
  warning?: string;
}

interface SearchPlan { slot: LevelingSlot; label: string; category: string; priorities: string[]; budget: number; query: Record<string, unknown> }

const statIds = {
  life: 'pseudo.pseudo_total_life',
  mana: 'pseudo.pseudo_total_mana',
  fireResistance: 'pseudo.pseudo_total_fire_resistance',
  coldResistance: 'pseudo.pseudo_total_cold_resistance',
  lightningResistance: 'pseudo.pseudo_total_lightning_resistance',
  movementSpeed: 'explicit.stat_2250533757',
};

const MILESTONES: Array<[ProgressionMilestone, number]> = [['10', 10], ['20', 20], ['30', 30], ['40', 40], ['advanced-campaign', 60], ['early-endgame', 65], ['endgame', 75]];

export function milestoneFor(level: number): ProgressionMilestone {
  let current: ProgressionMilestone = '10';
  for (const [name, threshold] of MILESTONES) if (level >= threshold) current = name;
  return current;
}
export function nextMilestoneLevel(level: number): number {
  for (const [, threshold] of MILESTONES) if (threshold > level) return threshold;
  return level + 10;
}
export function whatChangesAtNextMilestone(level: number): string {
  const milestone = milestoneFor(level);
  const next = nextMilestoneLevel(level);
  const descriptions: Record<ProgressionMilestone, string> = {
    '10': `At level ${next}, movement speed and a second elemental resistance become worth searching for.`,
    '20': `At level ${next}, weapon DPS thresholds rise and dual resistances become a real requirement.`,
    '30': `At level ${next}, resistance minimums rise again and Spirit-relevant slots start mattering for reservation skills.`,
    '40': `At level ${next} (advanced campaign), resistance and life minimums rise sharply ahead of endgame maps.`,
    'advanced-campaign': `At level ${next} (early endgame), search budgets should shift toward capped resistances over raw damage.`,
    'early-endgame': `At level ${next} (endgame), treat every slot search as a fresh, uncapped budget search.`,
    'endgame': 'You are at the endgame milestone; re-run this search whenever your budget or build changes.',
  };
  return descriptions[milestone];
}

function rankSlotsForMilestone(milestone: ProgressionMilestone): LevelingSlot[] {
  if (milestone === '10' || milestone === '20') return ['weapon', 'boots', 'body-armour', 'ring', 'helmet', 'belt', 'amulet', 'gloves'];
  if (milestone === '30' || milestone === '40') return ['weapon', 'boots', 'ring', 'body-armour', 'helmet', 'belt', 'amulet', 'gloves'];
  return ['weapon', 'ring', 'boots', 'body-armour', 'helmet', 'belt', 'amulet', 'gloves'];
}

export function buildLevelingSearchPlan(profile: BuildFitProfile, level: number, maxPrice: number, options: { weakestSlots?: LevelingSlot[]; maxSlots?: number } = {}): SearchPlan[] {
  const weapon = weaponCategory(profile);
  const defensive = profile.defenceStyle === 'energy-shield' ? 'Energy Shield' : profile.defenceStyle === 'life-armour' ? 'Armour' : 'Evasion';
  const bySlot: Record<LevelingSlot, Omit<SearchPlan, 'query' | 'budget'>> = {
    weapon: { slot: 'weapon', label: weapon.label, category: weapon.category, priorities: weapon.priorities },
    boots: { slot: 'boots', label: 'Boots', category: 'armour.boots', priorities: ['Movement Speed', 'Life', 'Elemental Resistances'] },
    'body-armour': { slot: 'body-armour', label: 'Body Armour', category: 'armour.chest', priorities: [defensive, 'Life', 'Elemental Resistances'] },
    helmet: { slot: 'helmet', label: 'Helmet', category: 'armour.helmet', priorities: ['Life', defensive, 'Elemental Resistances'] },
    gloves: { slot: 'gloves', label: 'Gloves', category: 'armour.gloves', priorities: ['Life', 'Elemental Resistances', weapon.attack ? 'Attack Speed' : 'Cast Speed'] },
    ring: { slot: 'ring', label: 'Ring', category: 'accessory.ring', priorities: ['Life', 'Elemental Resistances', damagePriority(profile)] },
    amulet: { slot: 'amulet', label: 'Amulet', category: 'accessory.amulet', priorities: [damagePriority(profile), 'Attributes', 'Life'] },
    belt: { slot: 'belt', label: 'Belt', category: 'accessory.belt', priorities: ['Life', 'Elemental Resistances'] },
  };
  const milestone = milestoneFor(level);
  const maxSlots = options.maxSlots ?? Object.keys(bySlot).length;
  const rankedSlots = rankSlotsForMilestone(milestone);
  const order: LevelingSlot[] = options.weakestSlots?.length
    ? ['weapon', ...options.weakestSlots.filter((s) => s !== 'weapon'), ...rankedSlots]
    : rankedSlots;
  const chosen = [...new Set(order)].slice(0, maxSlots).map((slot) => bySlot[slot]).filter(Boolean);
  const budget = Math.max(0.1, Math.round((maxPrice / chosen.length) * 100) / 100);
  return chosen.map((slot) => ({ ...slot, budget, query: levelingQuery(slot.slot, slot.category, level, budget, weapon.attack) }));
}

export async function searchLevelingItems(profile: BuildFitProfile, level: number, league: string, maxPrice: number, options: { weakestSlots?: LevelingSlot[]; maxSlots?: number; currency?: string } = {}): Promise<LevelingSlotResult[]> {
  const plans = buildLevelingSearchPlan(profile, level, maxPrice, options);
  const results: LevelingSlotResult[] = [];
  for (let index = 0; index < plans.length; index += 2) {
    const batch = await Promise.all(plans.slice(index, index + 2).map((plan) => searchSlot(plan, league, level, options.currency || 'exalted')));
    results.push(...batch);
  }
  return results;
}

async function fetchWithRateLimitRetry(url: string, buildInit: () => RequestInit, attempts = 2): Promise<Response> {
  let response = await fetch(url, buildInit());
  for (let attempt = 0; response.status === 429 && attempt < attempts; attempt += 1) {
    const retryAfterSeconds = Number(response.headers.get('retry-after')) || 1.5;
    await new Promise((resolve) => setTimeout(resolve, Math.min(5000, Math.max(0, retryAfterSeconds) * 1000)));
    response = await fetch(url, buildInit());
  }
  return response;
}

async function searchSlot(plan: SearchPlan, league: string, level: number, currency: string) {
  const query = structuredClone(plan.query) as any;
  query.query.filters.trade_filters = { filters: { price: { option: currency, max: plan.budget } } };
  // Built from the currency-adjusted query so a caller who selected e.g. divine/chaos still
  // gets a manual-search link filtered by their chosen currency if the API path below fails.
  const fallbackUrl = `${BASE}/trade2/search/poe2/${encodeURIComponent(league)}?q=${Buffer.from(JSON.stringify(query)).toString('base64url')}`;
  try {
    const response = await fetchWithRateLimitRetry(`${BASE}/api/trade2/search/poe2/${encodeURIComponent(league)}`, () => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'poe2-orb-analyzer/1.0 (personal leveling search)' },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(12_000),
    }));
    if (!response.ok) throw new Error(`Trade2 returned HTTP ${response.status}`);
    const search = await response.json() as { id?: string; result?: string[] };
    const officialUrl = search.id ? `${BASE}/trade2/search/poe2/${encodeURIComponent(league)}/${search.id}` : fallbackUrl;
    // Trade2 rejects fetch requests containing more than 10 result IDs with HTTP 400.
    const ids = selectPriceDiverseIds(search.result || [], TRADE2_MAX_FETCH_RESULTS);
    if (!search.id || !ids.length) return { ...pickPlan(plan), listings: [], officialUrl, warning: 'No matching online listings were found.' };
    const fetched = await fetchWithRateLimitRetry(`${BASE}/api/trade2/fetch/${ids.join(',')}?query=${search.id}`, () => ({
      headers: { Accept: 'application/json', 'User-Agent': 'poe2-orb-analyzer/1.0 (personal leveling search)' },
      signal: AbortSignal.timeout(12_000),
    }));
    if (!fetched.ok) throw new Error(`Trade2 listing fetch returned HTTP ${fetched.status}`);
    const payload = await fetched.json() as { result?: unknown[] };
      const listings = (payload.result || []).flatMap((row) => normalizeListing(row, plan.slot, officialUrl, level, plan.budget));
    return { ...pickPlan(plan), listings, officialUrl, warning: listings.length ? undefined : 'Listings were found, but none had a supported price.' };
  } catch (error) {
    return { ...pickPlan(plan), listings: [], officialUrl: fallbackUrl, warning: error instanceof Error ? error.message : 'Trade2 search failed.' };
  }
}

function levelingQuery(slot: LevelingSlot, category: string, level: number, maxPrice: number, attackWeapon: boolean) {
  const filters: Array<Record<string, unknown>> = [];
  if (slot !== 'weapon' && slot !== 'amulet') {
    filters.push({ id: statIds.life, value: { min: Math.max(10, Math.floor(level * .65)) }, disabled: false });
  }
  if (slot === 'boots') filters.push({ id: statIds.movementSpeed, value: { min: level >= 45 ? 20 : level >= 25 ? 15 : 10 }, disabled: false });
  if (['body-armour', 'boots', 'helmet', 'gloves', 'ring', 'belt'].includes(slot)) {
    filters.push({ id: statIds.fireResistance, value: { min: level >= 45 ? 20 : 10 }, disabled: false });
    filters.push({ id: statIds.coldResistance, value: { min: level >= 45 ? 20 : 10 }, disabled: false });
    filters.push({ id: statIds.lightningResistance, value: { min: level >= 45 ? 20 : 10 }, disabled: false });
  }
  const equipment: Record<string, unknown> = {};
  if (slot === 'weapon' && attackWeapon) equipment.dps = { min: Math.max(18, Math.floor(level * 2.4)) };
  return {
    query: {
      status: { option: 'online' },
      stats: filters.length ? [{ type: 'count', value: { min: level >= 25 ? 2 : 1 }, filters }] : [],
      filters: {
        type_filters: { filters: { category: { option: category }, rarity: { option: 'rare' } } },
        req_filters: { filters: { lvl: { max: level } } },
        equipment_filters: { filters: equipment },
        trade_filters: { filters: { price: { option: 'exalted', max: maxPrice } } },
      },
    },
    sort: { price: 'asc' },
  };
}

function verdictFor(requiredLevel: number | undefined, level: number, price: number, budget: number): { verdict: LevelingVerdict; usefulLevels: number; waitUntilLevel?: number } {
  if (requiredLevel && requiredLevel > level) return { verdict: 'wait', usefulLevels: 0, waitUntilLevel: requiredLevel };
  const usefulLevels = nextMilestoneLevel(level) - level;
  if (usefulLevels < 3 && price > budget * 0.3) return { verdict: 'not-worth-it', usefulLevels, waitUntilLevel: nextMilestoneLevel(level) };
  return { verdict: 'buy-now', usefulLevels };
}

function normalizeListing(value: unknown, slot: LevelingSlot, officialUrl: string, level: number, budget: number): LevelingListing[] {
  if (!value || typeof value !== 'object') return [];
  const row = value as Record<string, any>;
  const amount = Number(row.listing?.price?.amount);
  const rawCurrency = String(row.listing?.price?.currency || '').toLowerCase();
  const currency = rawCurrency || 'unknown currency';
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const item = row.item || {};
  const requirements = Array.isArray(item.requirements) ? item.requirements : [];
  const levelRequirement = requirements.find((entry: any) => /level/i.test(String(entry?.name || '')));
  const requiredLevel = Number(String(levelRequirement?.values?.[0]?.[0] || '').replace(/\D/g, '')) || undefined;
  const mods = [...(item.implicitMods || []), ...(item.explicitMods || [])].filter((mod) => typeof mod === 'string').slice(0, 8);
  const { verdict, usefulLevels, waitUntilLevel } = verdictFor(requiredLevel, level, amount, budget);
  return [{ id: String(row.id || ''), slot, name: String(item.name || item.typeLine || 'Unnamed item'), baseType: String(item.baseType || item.typeLine || ''), requiredLevel, price: amount, currency, account: row.listing?.account?.name, mods, officialUrl, verdict, usefulLevels, waitUntilLevel }];
}

function weaponCategory(profile: BuildFitProfile) {
  const text = `${profile.mainSkill || ''} ${profile.name} ${profile.notes || ''}`.toLowerCase();
  if (/ice shot|lightning arrow|bow|snipe|rain of arrows/.test(text)) return { label: 'Bow', category: 'weapon.bow', attack: true, priorities: ['Total DPS', 'Attack Speed', damagePriority(profile)] };
  if (/crossbow|grenade|galvanic shards/.test(text)) return { label: 'Crossbow', category: 'weapon.crossbow', attack: true, priorities: ['Total DPS', 'Attack Speed'] };
  if (/quarterstaff|ice strike|tempest flurry/.test(text)) return { label: 'Quarterstaff', category: 'weapon.quarterstaff', attack: true, priorities: ['Total DPS', 'Attack Speed'] };
  if (/minion|skeleton|summon/.test(text)) return { label: 'Sceptre', category: 'weapon.sceptre', attack: false, priorities: ['Spirit', 'Minion Skill Levels'] };
  if (/spell|spark|fireball|frostbolt|arc|caster/.test(text)) return { label: 'Wand', category: 'weapon.wand', attack: false, priorities: ['Spell Skill Levels', 'Spell Damage', 'Cast Speed'] };
  return { label: 'Weapon', category: 'weapon', attack: true, priorities: ['Total DPS', 'Attack Speed'] };
}

function damagePriority(profile: BuildFitProfile) {
  const text = `${profile.mainSkill || ''} ${profile.name} ${profile.notes || ''}`.toLowerCase();
  if (/ice|cold|frost|freeze/.test(text)) return 'Cold Damage';
  if (/lightning|shock|spark|storm/.test(text)) return 'Lightning Damage';
  if (/fire|ignite|flame/.test(text)) return 'Fire Damage';
  if (/chaos|poison/.test(text)) return 'Chaos Damage';
  return 'Damage';
}

function pickPlan(plan: SearchPlan) { return { slot: plan.slot, label: plan.label, priorities: plan.priorities, budget: plan.budget }; }

export function selectPriceDiverseIds(ids: string[], maximum: number) {
  if (ids.length <= maximum) return ids;
  const selected = new Set<number>();
  const cheapCount = Math.min(3, maximum);
  for (let index = 0; index < cheapCount; index += 1) selected.add(index);
  const remaining = maximum - selected.size;
  // A spread target can collide with an already-selected index (common once the result list
  // is only slightly longer than `maximum`); walk outward to the nearest free index instead of
  // silently deduping the collision away, so the intended count is still reached.
  const nearestFree = (target: number) => {
    for (let offset = 0; offset < ids.length; offset += 1) {
      const up = target + offset;
      if (up < ids.length && !selected.has(up)) return up;
      const down = target - offset;
      if (down >= 0 && !selected.has(down)) return down;
    }
    return null;
  };
  for (let index = 1; index <= remaining; index += 1) {
    const target = Math.round((index / (remaining + 1)) * (ids.length - 1));
    const chosen = nearestFree(target);
    if (chosen !== null) selected.add(chosen);
  }
  return [...selected].sort((a, b) => a - b).map((index) => ids[index]);
}
