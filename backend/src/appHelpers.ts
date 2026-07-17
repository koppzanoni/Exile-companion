import express from 'express';
import { z } from 'zod';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';
import {
  createBuildProfileFromPriorities,
  findDefaultBuildProfile,
  genericBuildFitProfile,
  type LegacyBuildProfileInput,
} from './buildProfiles.js';
import type { AppDatabase } from './db.js';
import { getSettings } from './db.js';
import { mergeItem, parseItemText } from './itemParser.js';
import { dedupeListings } from './trade.js';
import { runMarketPipeline, type MarketAnalysisResult } from './marketPipeline.js';
import { ClipboardItemParser } from './normalizedItemParser.js';
import { diagnoseBuild } from './buildDoctor.js';
import { type LevelingSlot } from './leveling.js';
import { compareUpgradeCandidates } from './upgradePlanner.js';
import { type BuildFitProfile, type ItemStats, type Listing } from './types.js';
import { type PoeCharacter } from './poeOAuth.js';
import { analyzeLoadout, type CharacterBuildLoadout } from './buildKnowledge.js';
import { diagnosePublicProfile } from './characterProfile.js';
import { evaluateOffence } from './offenceEvaluator.js';
import { loadActiveSkillMechanicProfile } from './skillMechanicProfiles.js';

export const spiritPlanSchema = z.object({
  weaponSet: z.union([z.literal(1), z.literal(2)]),
  baseSpirit: z.number().nonnegative().nullable(),
  equipmentSpirit: z.number().nullable().optional(),
  weaponSetSpirit: z
    .record(z.string(), z.number().nullable())
    .optional()
    .transform((value) => value as Partial<Record<1 | 2, number | null>> | undefined),
  reservationEfficiencyPercent: z.number().nullable().optional(),
  companionLimit: z.number().int().nonnegative().nullable(),
  roster: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(['persistent-skill', 'minion', 'companion', 'tamed-beast']),
        reservation: z.number().nonnegative().nullable(),
        required: z.boolean().optional(),
        unique: z.boolean().optional(),
      }),
    )
    .max(100),
});
export const hollowPlanSchema = z.object({
  hollow: z.boolean(),
  unarmed: z.boolean(),
  compatibleGloves: z.boolean(),
  transformedGloves: z.boolean(),
  attributesMet: z.boolean(),
  resistancesMet: z.boolean(),
  defencesMet: z.boolean(),
  skillCompatible: z.boolean(),
  comboConfigured: z.boolean(),
  weaponSetCompatible: z.boolean(),
  runesKnown: z.boolean(),
});

export function saveCheck(db: AppDatabase, payload: any) {
  return withTransaction(db, () => {
    const result = db
      .prepare(
        'INSERT INTO checks(league, item_json, result_json, data_source, official_url, warning) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        payload.league,
        JSON.stringify(payload.item),
        JSON.stringify({
          estimate: payload.estimate,
          evaluation: payload.evaluation,
          comparison: payload.comparison,
          craftingPotential: payload.craftingPotential,
          recommendation: payload.recommendation,
          marketAnalysis: payload.marketAnalysis,
          statValuation: payload.statValuation,
          equippedStatValuation: payload.equippedStatValuation,
          evaluations: payload.evaluations,
          decision: payload.decision,
          opportunity: payload.opportunity,
          beginnerSummary: payload.beginnerSummary,
        }),
        payload.dataSource,
        payload.officialUrl,
        payload.warning || null,
      );
    const checkId = Number(result.lastInsertRowid);
    const insert = db.prepare(
      'INSERT INTO comparable_listings(check_id, external_id, listing_json, similarity, excluded_reason) VALUES (?, ?, ?, ?, ?)',
    );
    for (const listing of payload.comparableListings)
      insert.run(checkId, listing.id, JSON.stringify(listing), listing.similarity || 0, listing.excludedReason || null);
    return checkId;
  });
}

export function withTransaction<T>(db: AppDatabase, operation: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function findCachedListings(db: AppDatabase, item: ItemStats, league: string, divineRate: number): Listing[] {
  const rows = db
    .prepare(
      `SELECT cl.listing_json FROM comparable_listings cl JOIN checks c ON c.id = cl.check_id WHERE c.league = ? AND c.data_source IN ('live','relaxed-live') AND cl.excluded_reason IS NULL AND c.created_at >= datetime('now', '-24 hours') ORDER BY c.created_at DESC LIMIT 100`,
    )
    .all(league) as Array<{ listing_json: string }>;
  const listings = rows
    .map((row) => JSON.parse(row.listing_json) as Listing)
    .filter((row) => row.baseType.toLowerCase() === item.baseType.toLowerCase());
  return dedupeListings(listings).map((row) => ({
    ...row,
    source: 'cache',
    exaltedPrice: row.currency === 'divine' ? row.price * divineRate : row.price,
  }));
}

export const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
export function requireAdmin(db: AppDatabase, res: express.Response): boolean {
  const userId = res.locals.user?.userId as number | undefined;
  const user = userId
    ? (db.prepare('SELECT is_admin AS isAdmin FROM app_users WHERE id=?').get(userId) as
        { isAdmin: number } | undefined)
    : null;
  if (!user?.isAdmin) {
    res.status(403).json({ error: 'Administrator access required.' });
    return false;
  }
  return true;
}
export function isPrivateOrReservedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 127 ||
      a === 10 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (family === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('::ffff:')) return isPrivateOrReservedIp(normalized.slice(7));
    return false;
  }
  return true;
}
export async function assertPublicHttpsUrl(url: URL): Promise<void> {
  if (url.protocol !== 'https:') throw new Error('Patch source URLs must use HTTPS.');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local'))
    throw new Error('Patch source must not point to a local or internal address.');
  if (isIP(hostname) && isPrivateOrReservedIp(hostname))
    throw new Error('Patch source must not point to a local or internal address.');
  const records = await dnsLookup(hostname, { all: true });
  if (records.some((record) => isPrivateOrReservedIp(record.address)))
    throw new Error('Patch source must not point to a local or internal address.');
}
export function safeSecret(actual: string, expected: string) {
  const a = createHash('sha256').update(actual).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
export const riskRank = (risk: 'low' | 'medium' | 'high' | 'unknown') =>
  ({ low: 0, medium: 1, unknown: 2, high: 3 })[risk];

export function normalizeStoredResult(value: any) {
  if (value && Object.prototype.hasOwnProperty.call(value, 'estimate'))
    return {
      marketAnalysis: null,
      statValuation: null,
      equippedStatValuation: null,
      evaluations: null,
      decision: null,
      opportunity: null,
      beginnerSummary: null,
      ...value,
    };
  return {
    estimate: value || null,
    evaluation: null,
    comparison: null,
    craftingPotential: null,
    recommendation: null,
    marketAnalysis: null,
    statValuation: null,
    equippedStatValuation: null,
    evaluations: null,
    decision: null,
    opportunity: null,
    beginnerSummary: null,
  };
}

export function loadCustomBuildProfiles(db: AppDatabase): BuildFitProfile[] {
  return (
    db.prepare('SELECT profile_json FROM build_profiles ORDER BY name').all() as Array<{ profile_json: string }>
  ).flatMap((row) => {
    try {
      return [JSON.parse(row.profile_json) as BuildFitProfile];
    } catch {
      return [];
    }
  });
}
export function resolveBuildFitProfile(db: AppDatabase, idOrName: string) {
  const builtIn = findDefaultBuildProfile(idOrName);
  if (builtIn) return builtIn;
  const value = idOrName.toLowerCase();
  return loadCustomBuildProfiles(db).find(
    (profile) => profile.id.toLowerCase() === value || profile.name.toLowerCase() === value,
  );
}
export function evaluateBuildDoctorOffence(
  db: AppDatabase,
  equipment: Array<{ slot: string; itemText: string }>,
  mainSkill: string,
  patch: string,
) {
  const profile = loadActiveSkillMechanicProfile(db, mainSkill, patch);
  const parsed = equipment.map((entry) => ({
    slot: entry.slot.toLowerCase(),
    item: mergeItem(parseItemText(entry.itemText), {}),
  }));
  const weapon =
    parsed.find(({ slot, item }) =>
      /weapon|main.?hand|bow|crossbow/.test(`${slot} ${item.itemType} ${item.itemClass}`.toLowerCase()),
    )?.item || mergeItem(parseItemText(''), {});
  return evaluateOffence(
    profile,
    weapon,
    {
      contentTarget: 'unknown',
      targetRarity: 'unknown',
      durationSeconds: 10,
      movementShare: 0,
    },
    patch,
  );
}
export function customId(value: string) {
  const match = value.match(/^(?:custom:)?(\d+)$/);
  return match ? Number(match[1]) : 0;
}
export function readCharacterLoadout(db: AppDatabase, characterId: number): CharacterBuildLoadout | null {
  const row = db
    .prepare(
      'SELECT patch,source,confidence,main_skill AS mainSkill,weapon_set AS weaponSet,available_spirit AS availableSpirit,skills_json AS skillsJson,key_passives_json AS keyPassivesJson FROM character_build_loadouts WHERE character_id=?',
    )
    .get(characterId) as any;
  if (!row) return null;
  return {
    patch: row.patch,
    source: row.source,
    confidence: row.confidence,
    mainSkill: row.mainSkill,
    weaponSet: row.weaponSet,
    availableSpirit: row.availableSpirit ?? undefined,
    skills: JSON.parse(row.skillsJson),
    keyPassives: JSON.parse(row.keyPassivesJson),
  };
}
export function listingToItemText(listing: Listing) {
  const labels: Record<string, string> = {
    life: 'to maximum Life',
    mana: 'to maximum Mana',
    fireResistance: '% to Fire Resistance',
    coldResistance: '% to Cold Resistance',
    lightningResistance: '% to Lightning Resistance',
    chaosResistance: '% to Chaos Resistance',
    movementSpeed: '% increased Movement Speed',
    spirit: 'to Spirit',
    strength: 'to Strength',
    dexterity: 'to Dexterity',
    intelligence: 'to Intelligence',
    armour: 'to Armour',
    evasion: 'to Evasion Rating',
    energyShield: 'to maximum Energy Shield',
  };
  const lines = [
    `Item Class: ${listing.baseType}`,
    'Rarity: Rare',
    listing.name || listing.baseType,
    listing.baseType,
    '--------',
  ];
  for (const [key, label] of Object.entries(labels)) {
    const value = (listing.stats as Record<string, unknown>)[key];
    if (typeof value === 'number' && value) lines.push(`+${value}${label.startsWith('%') ? '' : ' '}${label}`);
  }
  return lines.join('\n');
}
export function characterEvolutionData(
  db: AppDatabase,
  character: NonNullable<ReturnType<typeof getCharacterRow>>,
  patch?: string,
  from?: string,
  to?: string,
) {
  const rows = db
    .prepare(
      'SELECT id,patch,score,diagnosis_json AS diagnosisJson,created_at AS createdAt FROM character_snapshots WHERE character_id=? ORDER BY created_at',
    )
    .all(character.id) as Array<any>;
  const snapshots = rows
    .filter(
      (row) => (!patch || row.patch === patch) && (!from || row.createdAt >= from) && (!to || row.createdAt <= to),
    )
    .flatMap((row) => {
      try {
        const diagnosis = JSON.parse(row.diagnosisJson);
        return [
          {
            id: row.id,
            patch: row.patch,
            score: row.score,
            createdAt: row.createdAt,
            resistances: diagnosis.resistances?.current || {},
            spirit: diagnosis.spirit?.current ?? 0,
            defences: diagnosis.defenceByType || {},
          },
        ];
      } catch {
        return [];
      }
    });
  const purchases = (
    db
      .prepare(
        'SELECT id,slot,price,score_before AS scoreBefore,score_after AS scoreAfter,reversed_at AS reversedAt,created_at AS createdAt FROM purchase_transactions WHERE character_id=? ORDER BY created_at',
      )
      .all(character.id) as Array<any>
  ).filter((row) => (!from || row.createdAt >= from) && (!to || row.createdAt <= to));
  const active = purchases.filter((row) => !row.reversedAt);
  const efficiency = (row: any) => (row.scoreAfter - row.scoreBefore) / Math.max(row.price, 0.01);
  return {
    snapshots,
    purchases,
    bestPurchase: active.slice().sort((a, b) => efficiency(b) - efficiency(a))[0] || null,
    worstPurchase: active.slice().sort((a, b) => efficiency(a) - efficiency(b))[0] || null,
    currentBudget: character.budget,
    patches: [...new Set(rows.map((row) => row.patch))],
  };
}
export function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export async function cachedMarketPipeline(db: AppDatabase, options: Parameters<typeof runMarketPipeline>[0]) {
  const ttl = Math.max(15, Number(process.env.MARKET_CACHE_TTL_SECONDS || 120)),
    key = createHash('sha256')
      .update(
        JSON.stringify({
          item: options.item,
          itemAnalysis: options.itemAnalysis,
          build: options.build,
          league: options.league,
          divineRate: options.divineRate,
        }),
      )
      .digest('hex');
  db.prepare('DELETE FROM market_response_cache WHERE expires_at<=CURRENT_TIMESTAMP').run();
  const cached = db
    .prepare(
      'SELECT response_json AS responseJson FROM market_response_cache WHERE cache_key=? AND expires_at>CURRENT_TIMESTAMP',
    )
    .get(key) as { responseJson: string } | undefined;
  if (cached) {
    db.prepare('UPDATE market_response_cache SET hits=hits+1,last_hit_at=CURRENT_TIMESTAMP WHERE cache_key=?').run(key);
    const result = JSON.parse(cached.responseJson) as MarketAnalysisResult;
    return {
      ...result,
      dataSource: 'cache' as const,
      warning: `Cached Trade2 evidence (maximum age ${ttl} seconds). ${result.warning || ''}`.trim(),
    };
  }
  const result = await runMarketPipeline(options);
  if (result.dataSource !== 'none')
    db.prepare(
      "INSERT INTO market_response_cache(cache_key,response_json,expires_at) VALUES (?,?,datetime('now',?)) ON CONFLICT(cache_key) DO UPDATE SET response_json=excluded.response_json,expires_at=excluded.expires_at,hits=0,last_hit_at=NULL,created_at=CURRENT_TIMESTAMP",
    ).run(key, JSON.stringify(result), `+${ttl} seconds`);
  return result;
}
export async function monitorShoppingItem(db: AppDatabase, planId: number) {
  const plan = db
    .prepare(
      'SELECT id,character_id AS characterId,slot,listing_id AS listingId,price,status FROM shopping_plan_items WHERE id=?',
    )
    .get(planId) as any;
  if (!plan || !['searching', 'candidate'].includes(plan.status)) throw new Error('Shopping plan item is not active.');
  const character = getCharacterRow(db, plan.characterId);
  if (!character) throw new Error('Character not found.');
  const equipment = db
    .prepare('SELECT slot,item_text AS itemText FROM character_equipment WHERE character_id=?')
    .all(character.id) as Array<{ slot: string; itemText: string }>;
  const equipped = equipment.find((row) => row.slot === plan.slot);
  const build = character.buildProfileId
    ? resolveBuildFitProfile(db, character.buildProfileId)
    : getActiveBuildProfile(db) || genericBuildFitProfile;
  if (!equipped || !build) throw new Error('Equipped slot or build profile is missing.');
  const item = mergeItem(parseItemText(equipped.itemText), {});
  const normalized = new ClipboardItemParser().parseClipboard(equipped.itemText, {
    league: character.league,
    patch: readCharacterLoadout(db, character.id)?.patch || 'unknown',
  });
  const market = await runMarketPipeline({
    item,
    itemAnalysis: normalized,
    build,
    league: character.league,
    divineRate: getSettings(db).divineToExalted,
  });
  const current = market.comparablesUsed.find((row) => row.id === plan.listingId);
  const inputs = market.comparablesUsed.slice(0, 15).map((row) => ({
    id: row.id,
    slot: plan.slot,
    itemText: listingToItemText(row),
    price: row.exaltedPrice,
    currency: 'exalted' as const,
  }));
  const best = compareUpgradeCandidates(equipment, inputs, build).filter(
    (row) => row.scoreDelta > 0 && !row.newGaps.length,
  )[0];
  const events: Array<{ type: string; message: string }> = [];
  if (plan.listingId && !current)
    events.push({
      type: 'listing-unavailable',
      message: `Saved ${plan.slot} listing is no longer available.`,
    });
  if (current && plan.price !== null && current.exaltedPrice !== plan.price)
    events.push({
      type: 'price-changed',
      message: `${plan.slot} price changed from ${plan.price} to ${current.exaltedPrice} Exalted.`,
    });
  if (best && best.id !== plan.listingId && (plan.price === null || best.price <= plan.price))
    events.push({
      type: 'better-candidate',
      message: `A better ${plan.slot} candidate was found at ${best.price} Exalted.`,
    });
  const prefs = db.prepare('SELECT * FROM notification_preferences WHERE character_id=?').get(character.id) as any;
  const muted = prefs?.muted_until && prefs.muted_until > new Date().toISOString();
  for (const event of events) {
    db.prepare(
      'INSERT INTO market_monitor_events(character_id,plan_item_id,event_type,details_json) VALUES (?,?,?,?)',
    ).run(character.id, plan.id, event.type, JSON.stringify({ message: event.message, best }));
    const allowed =
      !muted &&
      (!prefs ||
        (event.type === 'price-changed'
          ? prefs.price_change
          : event.type === 'listing-unavailable'
            ? prefs.unavailable
            : prefs.better_candidate));
    if (allowed)
      db.prepare(
        'INSERT INTO character_alerts(character_id,type,severity,message,metadata_json) VALUES (?,?,?,?,?)',
      ).run(
        character.id,
        event.type,
        event.type === 'listing-unavailable' ? 'warning' : 'info',
        event.message,
        JSON.stringify({ planItemId: plan.id, best }),
      );
  }
  return { events, best, market };
}
export function buildGeminiCharacterContext(db: AppDatabase, characterId: number) {
  const character = getCharacterRow(db, characterId);
  if (!character) return null;
  const equipment = db
    .prepare('SELECT slot,item_text AS itemText FROM character_equipment WHERE character_id=?')
    .all(characterId) as Array<{ slot: string; itemText: string }>;
  const build = character.buildProfileId
    ? resolveBuildFitProfile(db, character.buildProfileId)
    : getActiveBuildProfile(db) || genericBuildFitProfile;
  const diagnosis = build ? diagnoseBuild(equipment, build) : null;
  const loadout = readCharacterLoadout(db, characterId);
  const purchases = db
    .prepare(
      'SELECT slot,price,score_before AS scoreBefore,score_after AS scoreAfter,reversed_at AS reversedAt,created_at AS createdAt FROM purchase_transactions WHERE character_id=? ORDER BY created_at DESC LIMIT 20',
    )
    .all(characterId);
  const calibration = db
    .prepare(
      'SELECT slot,patch,predicted_delta AS predictedDelta,actual_delta AS actualDelta,absolute_error AS absoluteError FROM recommendation_calibration WHERE character_id=? ORDER BY created_at DESC LIMIT 20',
    )
    .all(characterId);
  const alerts = db
    .prepare(
      'SELECT type,severity,message,created_at AS createdAt FROM character_alerts WHERE character_id=? AND read_at IS NULL ORDER BY created_at DESC LIMIT 20',
    )
    .all(characterId);
  const publicRow = db
    .prepare('SELECT profile_json AS profileJson FROM character_public_profiles WHERE character_id=?')
    .get(characterId) as { profileJson: string } | undefined;
  let publicProfile = null,
    publicDiagnostics: any[] = [];
  try {
    if (publicRow) {
      publicProfile = JSON.parse(publicRow.profileJson);
      publicDiagnostics = diagnosePublicProfile(publicProfile);
    }
  } catch {
    publicProfile = null;
    publicDiagnostics = [];
  }
  const sales = db
    .prepare(
      'SELECT item_name AS itemName,status,listed_price AS listedPrice,final_price AS finalPrice,currency,listed_at AS listedAt,sold_at AS soldAt FROM sale_journal WHERE character_id=? ORDER BY updated_at DESC LIMIT 20',
    )
    .all(characterId);
  return {
    character,
    equipment,
    diagnosis,
    loadout,
    mechanics: loadout ? analyzeLoadout(loadout) : null,
    postPurchase: { purchases, calibration, alerts },
    publicCharacter: {
      profile: publicProfile,
      diagnostics: publicDiagnostics,
      warning: 'Public poe.ninja data is independent and must not be treated as official account state.',
    },
    sales,
    guardrails: [
      'Do not recommend a change that creates a recorded Spirit, resistance or attribute gap.',
      'Treat patch/source/confidence as provenance; unknown mechanics must remain unknown.',
      'Compare predicted and actual gains when discussing purchase quality. Only confirmed sold prices reduce net cost.',
    ],
  };
}

export function characterOwnedByUser(db: AppDatabase, characterId: number, userId: number | undefined): boolean {
  if (!userId) return true;
  return Boolean(db.prepare('SELECT 1 FROM characters WHERE id=? AND user_id=?').get(characterId, userId));
}

export function getCharacterRow(db: AppDatabase, id: number) {
  if (!id) return null;
  return (
    (db
      .prepare(
        'SELECT id, name, league, level, class_name AS className, ascendancy, build_profile_id AS buildProfileId, stage, budget, target_content AS targetContent, current_issues AS currentIssues, updated_at AS updatedAt FROM characters WHERE id = ?',
      )
      .get(id) as
      | {
          id: number;
          name: string;
          league: string;
          level: number | null;
          className: string;
          ascendancy: string;
          buildProfileId: string;
          stage: string | null;
          budget: number | null;
          targetContent: string;
          currentIssues: string;
          updatedAt: string;
        }
      | undefined) || null
  );
}
export function importPoeCharacter(db: AppDatabase, remote: PoeCharacter, userId?: number) {
  const name = String(remote.name || '').trim();
  if (!name) throw new Error('Path of Exile returned a character without a name.');
  const league = String(remote.league || 'Unknown League'),
    className = String(remote.className || remote.class || ''),
    ascendancy = String(remote.ascendancy || ''),
    level = Number(remote.level) || null;
  db.prepare(
    `INSERT INTO characters(name,league,level,class_name,ascendancy,stage,user_id,updated_at) VALUES (?,?,?,?,?,'endgame',?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,name,league) DO UPDATE SET level=excluded.level,class_name=excluded.class_name,ascendancy=excluded.ascendancy,updated_at=CURRENT_TIMESTAMP`,
  ).run(name, league, level, className, ascendancy, userId ?? null);
  const character = (
    userId
      ? db.prepare('SELECT id FROM characters WHERE name=? AND league=? AND user_id=?').get(name, league, userId)
      : db
          .prepare('SELECT id FROM characters WHERE name=? AND league=? AND user_id IS NULL ORDER BY id DESC')
          .get(name, league)
  ) as { id: number };
  const equipment = equipmentFromPoeCharacter(remote),
    upsert = db.prepare(
      'INSERT INTO character_equipment(character_id,slot,item_text,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(character_id,slot) DO UPDATE SET item_text=excluded.item_text,updated_at=CURRENT_TIMESTAMP',
    );
  for (const entry of equipment) upsert.run(character.id, entry.slot, entry.itemText);
  return character.id;
}
export function equipmentFromPoeCharacter(remote: PoeCharacter) {
  const raw = [
    ...(Array.isArray(remote.equipment) ? remote.equipment : []),
    ...(Array.isArray(remote.items) ? remote.items : []),
  ];
  const bySlot = new Map<string, string>();
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Record<string, unknown>;
    const slot = poeSlot(String(item.inventoryId || item.slot || ''));
    if (!slot || bySlot.has(slot)) continue;
    const text = poeItemText(item);
    if (text) bySlot.set(slot, text);
  }
  return [...bySlot].map(([slot, itemText]) => ({ slot, itemText }));
}
export function poeSlot(value: string) {
  const normalized = value.toLowerCase();
  if (/weapon|mainhand/.test(normalized)) return 'Weapon';
  if (/offhand/.test(normalized)) return 'Offhand';
  if (/helm/.test(normalized)) return 'Helmet';
  if (/body|chest/.test(normalized)) return 'Body Armour';
  if (/glove/.test(normalized)) return 'Gloves';
  if (/boot/.test(normalized)) return 'Boots';
  if (/belt/.test(normalized)) return 'Belt';
  if (/amulet/.test(normalized)) return 'Amulet';
  if (/ring/.test(normalized)) return normalized.includes('2') || normalized.includes('right') ? 'Ring 2' : 'Ring 1';
  return '';
}
export function poeItemText(item: Record<string, unknown>) {
  const typeLine = String(item.typeLine || item.baseType || '').trim();
  if (!typeLine) return '';
  const rarity = String(item.rarity || 'Rare');
  const lines = [`Item Class: ${String(item.itemClass || 'Unknown')}`, `Rarity: ${rarity}`];
  if (item.name) lines.push(String(item.name));
  lines.push(typeLine, '--------');
  if (item.ilvl) lines.push(`Item Level: ${item.ilvl}`);
  const mods = [
    ...readPoeLines(item.implicitMods),
    ...readPoeLines(item.explicitMods),
    ...readPoeLines(item.enchantMods),
    ...readPoeLines(item.craftedMods),
  ];
  if (mods.length) lines.push(...mods);
  return lines.join('\n');
}
export function readPoeLines(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((row) =>
          typeof row === 'string'
            ? row
            : row && typeof row === 'object'
              ? String((row as Record<string, unknown>).description || '')
              : '',
        )
        .filter(Boolean)
    : ([] as string[]);
}
export function getSavedCharacterTotals(db: AppDatabase, characterId: number) {
  const totals: {
    fireResistance: number;
    coldResistance: number;
    lightningResistance: number;
    chaosResistance: number;
    strength: number;
    dexterity: number;
    intelligence: number;
    spirit: number;
  } = {
    fireResistance: 0,
    coldResistance: 0,
    lightningResistance: 0,
    chaosResistance: 0,
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    spirit: 0,
  };
  const rows = db
    .prepare('SELECT item_text AS itemText FROM character_equipment WHERE character_id = ?')
    .all(characterId) as Array<{ itemText: string }>;
  for (const row of rows) {
    const item = mergeItem(parseItemText(row.itemText), {});
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] += Number(item[key]) || 0;
  }
  return totals;
}

export function mapToLevelingSlot(slot: string): LevelingSlot | undefined {
  const value = slot.toLowerCase();
  if (/weapon|bow|crossbow|wand|staff|sceptre|axe|sword|mace|dagger|flail|spear/.test(value)) return 'weapon';
  if (/boot/.test(value)) return 'boots';
  if (/body|chest|armour/.test(value) && !/gloves|boots/.test(value)) return 'body-armour';
  if (/helm/.test(value)) return 'helmet';
  if (/glove/.test(value)) return 'gloves';
  if (/ring/.test(value)) return 'ring';
  if (/amulet/.test(value)) return 'amulet';
  if (/belt/.test(value)) return 'belt';
  return undefined;
}

export function upsertActiveBuildProfile(db: AppDatabase, input: LegacyBuildProfileInput): BuildFitProfile {
  const existing = db.prepare('SELECT id FROM build_profiles WHERE name = ?').get(input.name) as
    { id: number } | undefined;
  const id =
    existing?.id ??
    Number(
      db.prepare('INSERT INTO build_profiles(name,profile_json) VALUES (?,?)').run(input.name, '{}').lastInsertRowid,
    );
  const profile = createBuildProfileFromPriorities(`custom:${id}`, input);
  db.prepare('UPDATE build_profiles SET name=?,profile_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(
    input.name,
    JSON.stringify(profile),
    id,
  );
  db.prepare(
    `INSERT INTO settings(key, value, updated_at) VALUES ('activeBuildProfileId', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
  ).run(profile.id);
  return profile;
}

export function getActiveBuildProfile(db: AppDatabase): BuildFitProfile | null {
  const pointer = db.prepare("SELECT value FROM settings WHERE key = 'activeBuildProfileId'").get() as
    { value: string } | undefined;
  if (pointer) {
    const resolved = resolveBuildFitProfile(db, pointer.value);
    if (resolved) return resolved;
  }
  const legacy = db.prepare("SELECT value FROM settings WHERE key = 'buildProfile'").get() as
    { value: string } | undefined;
  if (!legacy) return null;
  try {
    const old = JSON.parse(legacy.value);
    const migrated = upsertActiveBuildProfile(db, {
      name: old.name,
      className: old.className,
      ascendancy: old.ascendancy,
      mainSkill: old.mainSkill,
      guideUrl: old.guideUrl,
      stage: old.stage || 'endgame',
      evaluationStyle: old.evaluationStyle || 'balanced',
      defenceStyle: old.defenceStyle || 'custom',
      priorities: old.priorities || [],
      requiredMods: old.requiredMods || [],
      desiredMods: old.desiredMods || [],
      notes: old.notes,
    });
    db.prepare("DELETE FROM settings WHERE key = 'buildProfile'").run();
    return migrated;
  } catch {
    return null;
  }
}
