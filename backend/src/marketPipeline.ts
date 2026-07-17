import { detectItemCategory } from './categoryDetection.js';
import type { BuildFitProfile, ItemStats, Listing } from './types.js';
import type { ItemAnalysisInput, MarketSearchQuery } from './engineContracts.js';
import { OfficialTradeMarketProvider, type TradeTransport } from './officialTradeMarketProvider.js';
import { buildLayeredSearches, type LayeredMarketQuery, type SearchTier } from './marketSearchStrategies.js';
import { valueMarket, type MarketComparable, type MarketValuation, type ValuedComparable } from './marketValuationEngine.js';
import { convertCurrency, describeMainDifference, explainItemSignals, scoreSimilarity } from './pricing.js';
import { BASE, buildTradeQuery, buildTradeUrl, normalizeOfficialListing, postOfficialSearch, type TradeQueryOptions } from './trade.js';

const MIN_SAMPLE = 5;
const FALLBACK_MIN_SIMILARITY = 30;
const TIER_TIMEOUT_MS = 12000;
const TIER_SIMILARITY_THRESHOLD: Record<SearchTier, number> = { 'A-exact': 55, 'B-functional': 45, 'C-90': 90, 'D-80': 80, 'D-70': 70, 'build-fit': 50 };
const TIER_TOLERANCE_SCALE: Record<SearchTier, number> = { 'A-exact': 1, 'B-functional': 1.15, 'C-90': 1.3, 'D-80': 1.5, 'D-70': 1.8, 'build-fit': 1.6 };

export interface WeightedStat { stat: string; weight: number }

export type MarketDataSource = 'live' | 'relaxed-live' | 'insufficient-live' | 'similarity-fallback' | 'cache' | 'manual' | 'none';

export interface MarketAnalysisResult {
  strategyUsed: string;
  relaxed: boolean;
  relaxationSteps: string[];
  foundCount: number;
  discardedCount: number;
  usedCount: number;
  averageSimilarity: number;
  medianListingAgeDays: number | null;
  distinctSellers: number;
  discardReasons: Record<string, number>;
  lowConfidenceReason?: string;
  comparablesUsed: Listing[];
  comparablesRejected: Listing[];
  valuation: MarketValuation;
  dataSource: MarketDataSource;
  officialUrl: string;
  warning: string;
}

export function deriveWeightedStats(item: ItemStats, build: BuildFitProfile): WeightedStat[] {
  const category = detectItemCategory(item).key;
  const slotPriorities = build.categoryPriorities[category] || [];
  const weights = new Map<string, number>();
  const bump = (stat: string, amount: number) => weights.set(stat, (weights.get(stat) || 0) + amount);
  const statKeys: Array<[RegExp, keyof ItemStats]> = [
    [/life/i, 'life'], [/mana/i, 'mana'], [/fire resist/i, 'fireResistance'], [/cold resist/i, 'coldResistance'],
    [/lightning resist/i, 'lightningResistance'], [/chaos resist/i, 'chaosResistance'], [/movement/i, 'movementSpeed'],
    [/spirit/i, 'spirit'], [/strength/i, 'strength'], [/dexterity/i, 'dexterity'], [/intelligence/i, 'intelligence'],
  ];
  const relevantTextLists = [...slotPriorities.map((s) => [s, 8] as const), ...build.defensiveStats.map((s) => [s, 5] as const), ...build.offensiveStats.map((s) => [s, 4] as const), ...build.utilityStats.map((s) => [s, 2] as const)];
  for (const [text, weight] of relevantTextLists) {
    for (const [pattern, key] of statKeys) if (pattern.test(text) && typeof item[key] === 'number') bump(key, weight);
  }
  for (const key of ['life', 'fireResistance', 'coldResistance', 'lightningResistance', 'chaosResistance', 'movementSpeed', 'spirit'] as const) {
    if (typeof item[key] === 'number' && (item[key] as number) > 0 && !weights.has(key)) bump(key, 1);
  }
  return [...weights.entries()].map(([stat, weight]) => ({ stat, weight })).sort((a, b) => b.weight - a.weight);
}

function toRealQuery(tier: LayeredMarketQuery, item: ItemStats, league: string): MarketSearchQuery {
  const mode = tier.baseType ? 'exact-base' : 'same-slot';
  const options: TradeQueryOptions = { toleranceScale: TIER_TOLERANCE_SCALE[tier.tier], onlyStats: tier.retainedStats };
  return { league, patch: tier.patch, itemClass: tier.itemClass, baseType: tier.baseType, filters: buildTradeQuery(item, mode, options), limit: tier.limit };
}

export class RealTradeTransport implements TradeTransport {
  constructor(private item: ItemStats) {}
  async search(query: MarketSearchQuery, signal: AbortSignal): Promise<unknown[]> {
    const body = query.filters as ReturnType<typeof buildTradeQuery>;
    const response = await postOfficialSearch(body, query.league, signal);
    const search = (await response.json()) as { id?: string; result?: string[] };
    const ids = search.result?.slice(0, query.limit || 40) || [];
    const officialUrl = search.id ? `${BASE}/trade2/search/poe2/${encodeURIComponent(query.league)}/${search.id}` : buildTradeUrl(this.item, query.league);
    if (!search.id || !ids.length) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    const payloads: unknown[] = [];
    for (const chunk of chunks) {
      const fetchResponse = await fetch(`${BASE}/api/trade2/fetch/${chunk.join(',')}?query=${search.id}`, { headers: { Accept: 'application/json', 'User-Agent': 'poe2-orb-analyzer/1.0' }, signal });
      if (!fetchResponse.ok) throw new Error(`Trade2 listing fetch returned HTTP ${fetchResponse.status}`);
      const data = (await fetchResponse.json()) as { result?: unknown[] };
      payloads.push(...(data.result || []).map((row) => ({ ...(row as Record<string, unknown>), __officialUrl: officialUrl })));
    }
    return payloads;
  }
  async currencyRates() { return {}; }
}

export function createOfficialMarketProvider(item: ItemStats) {
  return new OfficialTradeMarketProvider(new RealTradeTransport(item), { timeoutMs: TIER_TIMEOUT_MS, cacheMs: 60000, minIntervalMs: 250, retries: 1 });
}

function toComparable(listing: Listing, divineRate: number, strategy: string): MarketComparable {
  return { id: listing.id, price: listing.price, currency: listing.currency, divineRate, similarity: (listing.similarity || 0) / 100, indexedAt: listing.indexedAt, listingType: 'asking', baseType: listing.baseType, corrupted: false, account: listing.account, strategy };
}

function fromValued(row: ValuedComparable, listing: Listing, item: ItemStats): Listing {
  return { ...listing, similarity: Math.round(row.similarity * 100), excludedReason: row.rejectedReason, mainDifference: describeMainDifference(item, listing), foundByStrategy: listing.foundByStrategy || row.strategy };
}

export async function runMarketPipeline(opts: { item: ItemStats; itemAnalysis: ItemAnalysisInput; build: BuildFitProfile; league: string; divineRate: number; provider?: ReturnType<typeof createOfficialMarketProvider> }): Promise<MarketAnalysisResult> {
  const weightedStats = deriveWeightedStats(opts.item, opts.build);
  const tiers = buildLayeredSearches(opts.itemAnalysis, weightedStats, opts.league).filter((t) => t.tier !== 'build-fit');
  const provider = opts.provider || createOfficialMarketProvider(opts.item);
  const fallbackUrl = buildTradeUrl(opts.item, opts.league);
  const relaxationSteps: string[] = [];
  let finalTier: LayeredMarketQuery | undefined;
  let finalListingsWithSimilarity: Listing[] = [];
  let finalOfficialUrl = fallbackUrl;
  let finalFoundCount = 0;
  let similarityDiscards: Listing[] = [];
  let providerWarning: string | undefined;
  let anyResultsAtAll = false;
  let bestScoredAcrossTiers: Listing[] = [];
  let bestAverageSimilarity = -1;

  for (const tier of tiers) {
    relaxationSteps.push(tier.label);
    const query = toRealQuery(tier, opts.item, opts.league);
    const result = await provider.search(query);
    if (result.warning && !result.warning.includes('Cached')) providerWarning = result.warning;
    const raw = result.listings as Array<Record<string, unknown>>;
    const officialUrl = (raw[0]?.__officialUrl as string) || fallbackUrl;
    const normalized = raw.map((payload) => normalizeOfficialListing(payload, opts.divineRate, officialUrl)).filter((v): v is Listing => Boolean(v));
    finalFoundCount = normalized.length;
    if (normalized.length) anyResultsAtAll = true;
    const scored = normalized.map((listing) => ({ ...listing, similarity: scoreSimilarity(opts.item, listing) }));
    const averageScoredSimilarity = scored.length ? scored.reduce((sum, listing) => sum + (listing.similarity || 0), 0) / scored.length : -1;
    if (scored.length && averageScoredSimilarity > bestAverageSimilarity) { bestAverageSimilarity = averageScoredSimilarity; bestScoredAcrossTiers = scored; }
    const threshold = TIER_SIMILARITY_THRESHOLD[tier.tier];
    const passing = scored.filter((listing) => (listing.similarity || 0) >= threshold);
    const discarded = scored.filter((listing) => (listing.similarity || 0) < threshold).map((listing) => ({ ...listing, excludedReason: `Similarity ${listing.similarity}% is below the ${threshold}% threshold for the "${tier.label}" strategy.`, mainDifference: describeMainDifference(opts.item, listing), foundByStrategy: tier.label }));
    finalTier = tier;
    finalListingsWithSimilarity = passing;
    finalOfficialUrl = officialUrl;
    similarityDiscards = discarded;
    if (passing.length >= MIN_SAMPLE) break;
  }

  const strategyLabel = finalTier?.label || 'No strategy executed';
  const relaxed = relaxationSteps.length > 1;

  if (!finalListingsWithSimilarity.length) {
    const fallbackCandidates = bestScoredAcrossTiers.filter((listing) => (listing.similarity || 0) >= FALLBACK_MIN_SIMILARITY);
    if (fallbackCandidates.length) {
      const fallbackStrategy = `${strategyLabel} (similarity fallback, no exact-base match found)`;
      const comparables = fallbackCandidates.map((listing) => toComparable(listing, opts.divineRate, fallbackStrategy));
      const valuation = valueMarket(comparables);
      if (valuation.usedCount) {
        const usedListings = valuation.comparablesUsed.map((row) => fromValued(row, fallbackCandidates.find((l) => l.id === row.id)!, opts.item));
        const rejectedFromValuation = valuation.comparablesRejected.map((row) => fromValued(row, fallbackCandidates.find((l) => l.id === row.id)!, opts.item));
        const allRejected = [...similarityDiscards, ...rejectedFromValuation];
        const discardReasons: Record<string, number> = {};
        for (const row of allRejected) discardReasons[row.excludedReason || 'unknown'] = (discardReasons[row.excludedReason || 'unknown'] || 0) + 1;
        return {
          strategyUsed: fallbackStrategy, relaxed: true, relaxationSteps: [...relaxationSteps, 'similarity-fallback'],
          foundCount: finalFoundCount, discardedCount: allRejected.length, usedCount: valuation.usedCount,
          averageSimilarity: valuation.averageSimilarity, medianListingAgeDays: valuation.medianListingAgeDays, distinctSellers: valuation.distinctSellers,
          discardReasons,
          lowConfidenceReason: `No listing matched this item's exact base type or cleared the normal similarity bar. This estimate is built from the ${valuation.usedCount} closest comparable(s) found instead (avg similarity ${valuation.averageSimilarity}%) and should be treated as a rough approximation.`,
          comparablesUsed: usedListings, comparablesRejected: allRejected,
          valuation, dataSource: 'similarity-fallback', officialUrl: finalOfficialUrl,
          warning: `No exact-base or standard-similarity match was found on Trade2. This price is approximated from the ${valuation.usedCount} closest comparable item(s) available (avg similarity ${valuation.averageSimilarity}%) — verify manually before trading.`,
        };
      }
    }
    const discardReasons: Record<string, number> = {};
    for (const row of similarityDiscards) discardReasons[row.excludedReason || 'unknown'] = (discardReasons[row.excludedReason || 'unknown'] || 0) + 1;
    const emptyValuation = valueMarket([]);
    const warning = anyResultsAtAll
      ? `Trade2 returned listings for every strategy tried (${relaxationSteps.join(' -> ')}), but none met the similarity bar for a defensible estimate. No price was inferred.`
      : providerWarning || 'Official Trade2 returned no comparable listings, even after progressively relaxing the search. No price was inferred.';
    return { strategyUsed: strategyLabel, relaxed, relaxationSteps, foundCount: finalFoundCount, discardedCount: similarityDiscards.length, usedCount: 0, averageSimilarity: 0, medianListingAgeDays: null, distinctSellers: 0, discardReasons, lowConfidenceReason: 'No comparable listings passed the similarity threshold for any strategy.', comparablesUsed: [], comparablesRejected: similarityDiscards, valuation: emptyValuation, dataSource: 'none', officialUrl: finalOfficialUrl, warning };
  }

  const comparables = finalListingsWithSimilarity.map((listing) => toComparable(listing, opts.divineRate, strategyLabel));
  const valuation = valueMarket(comparables, opts.item.baseType);
  const usedListings = valuation.comparablesUsed.map((row) => fromValued(row, finalListingsWithSimilarity.find((l) => l.id === row.id)!, opts.item));
  const rejectedFromValuation = valuation.comparablesRejected.map((row) => fromValued(row, finalListingsWithSimilarity.find((l) => l.id === row.id)!, opts.item));
  const comparablesRejected = [...similarityDiscards, ...rejectedFromValuation];

  const discardReasons: Record<string, number> = {};
  for (const row of comparablesRejected) { const key = row.excludedReason || 'unknown'; discardReasons[key] = (discardReasons[key] || 0) + 1; }

  const insufficientSample = valuation.usedCount < MIN_SAMPLE;
  const dataSource: MarketDataSource = relaxed ? (insufficientSample ? 'insufficient-live' : 'relaxed-live') : (insufficientSample ? 'insufficient-live' : 'live');
  const warning = dataSource === 'live'
    ? `Current Trade2 data: ${valuation.usedCount} comparable listings matched on the first search strategy ("${strategyLabel}").`
    : dataSource === 'relaxed-live'
      ? `Search was relaxed through ${relaxationSteps.length} strategies (${relaxationSteps.join(' -> ')}) to find enough comparables. This is a relaxed-search estimate, not an exact-match live price.`
      : `Only ${valuation.usedCount} usable comparable(s) were found after trying every search strategy (${relaxationSteps.join(' -> ')}). Treat this estimate as low-confidence and verify manually.`;

  return {
    strategyUsed: strategyLabel, relaxed, relaxationSteps, foundCount: finalFoundCount, discardedCount: comparablesRejected.length, usedCount: valuation.usedCount,
    averageSimilarity: valuation.averageSimilarity, medianListingAgeDays: valuation.medianListingAgeDays, distinctSellers: valuation.distinctSellers,
    discardReasons, lowConfidenceReason: valuation.lowConfidenceReason, comparablesUsed: usedListings, comparablesRejected,
    valuation, dataSource, officialUrl: finalOfficialUrl, warning,
  };
}

export function toLegacyEstimate(analysis: MarketAnalysisResult, item: ItemStats, divineRate: number): import('./types.js').Estimate | null {
  if (!analysis.usedCount) return null;
  const { valuation } = analysis;
  const { positive, negative } = explainItemSignals(item);
  const confidence = valuation.confidence === 'High' ? 'high' : valuation.confidence === 'Medium' ? 'medium' : 'low';
  const explanation = [
    `Strategy "${analysis.strategyUsed}" used ${valuation.usedCount} of ${analysis.foundCount} listings found (${analysis.discardedCount} discarded).`,
    ...valuation.explanation,
  ];
  if (analysis.relaxed) explanation.push(`Search was progressively relaxed through: ${analysis.relaxationSteps.join(' -> ')}.`);
  if (valuation.lowConfidenceReason) explanation.push(valuation.lowConfidenceReason);
  return {
    quickSell: valuation.quickSell, fair: valuation.fairPrice, high: valuation.listingPrice,
    divine: { quickSell: convertCurrency(valuation.quickSell, divineRate), fair: convertCurrency(valuation.fairPrice, divineRate), high: convertCurrency(valuation.listingPrice, divineRate) },
    confidence, positiveMods: positive, negativeMods: negative, explanation,
    usedCount: valuation.usedCount, excludedCount: analysis.discardedCount,
  };
}

export function manualMarketAnalysis(item: ItemStats, listings: Listing[], divineRate: number): MarketAnalysisResult {
  if (!listings.length) {
    const emptyValuation = valueMarket([]);
    return { strategyUsed: 'manual', relaxed: false, relaxationSteps: [], foundCount: 0, discardedCount: 0, usedCount: 0, averageSimilarity: 0, medianListingAgeDays: null, distinctSellers: 0, discardReasons: {}, lowConfidenceReason: 'No listings were pasted.', comparablesUsed: [], comparablesRejected: [], valuation: emptyValuation, dataSource: 'none', officialUrl: '', warning: 'No market listings are available. Paste official exported listings to calculate an estimate.' };
  }
  const scored = listings.map((listing) => ({ ...listing, similarity: scoreSimilarity(item, listing) }));
  const comparables = scored.map((listing) => toComparable(listing, divineRate, 'manual'));
  const valuation = valueMarket(comparables, item.baseType);
  if (!valuation.usedCount) {
    const fallbackCandidates = scored.filter((listing) => (listing.similarity || 0) >= FALLBACK_MIN_SIMILARITY);
    if (fallbackCandidates.length) {
      const fallbackComparables = fallbackCandidates.map((listing) => toComparable(listing, divineRate, 'manual (similarity fallback)'));
      const fallbackValuation = valueMarket(fallbackComparables);
      if (fallbackValuation.usedCount) {
        const usedListings = fallbackValuation.comparablesUsed.map((row) => fromValued(row, fallbackCandidates.find((l) => l.id === row.id)!, item));
        const rejected = fallbackValuation.comparablesRejected.map((row) => fromValued(row, fallbackCandidates.find((l) => l.id === row.id)!, item));
        const discardReasons: Record<string, number> = {};
        for (const row of rejected) discardReasons[row.excludedReason || 'unknown'] = (discardReasons[row.excludedReason || 'unknown'] || 0) + 1;
        return {
          strategyUsed: 'manual (similarity fallback)', relaxed: true, relaxationSteps: ['manual', 'similarity-fallback'],
          foundCount: listings.length, discardedCount: rejected.length, usedCount: fallbackValuation.usedCount,
          averageSimilarity: fallbackValuation.averageSimilarity, medianListingAgeDays: fallbackValuation.medianListingAgeDays, distinctSellers: fallbackValuation.distinctSellers,
          discardReasons,
          lowConfidenceReason: `None of the pasted listings matched this item's exact base type. This estimate is built from the ${fallbackValuation.usedCount} closest comparable(s) instead (avg similarity ${fallbackValuation.averageSimilarity}%) and should be treated as a rough approximation.`,
          comparablesUsed: usedListings, comparablesRejected: rejected,
          valuation: fallbackValuation, dataSource: 'similarity-fallback', officialUrl: '',
          warning: `None of the pasted listings share this item's exact base type. This price is approximated from the ${fallbackValuation.usedCount} closest comparable(s) you pasted (avg similarity ${fallbackValuation.averageSimilarity}%) — verify manually before trading.`,
        };
      }
    }
  }
  const usedListings = valuation.comparablesUsed.map((row) => fromValued(row, scored.find((l) => l.id === row.id)!, item));
  const rejected = valuation.comparablesRejected.map((row) => fromValued(row, scored.find((l) => l.id === row.id)!, item));
  const discardReasons: Record<string, number> = {};
  for (const row of rejected) { const key = row.excludedReason || 'unknown'; discardReasons[key] = (discardReasons[key] || 0) + 1; }
  return {
    strategyUsed: 'manual', relaxed: false, relaxationSteps: [], foundCount: listings.length, discardedCount: rejected.length, usedCount: valuation.usedCount,
    averageSimilarity: valuation.averageSimilarity, medianListingAgeDays: valuation.medianListingAgeDays, distinctSellers: valuation.distinctSellers,
    discardReasons, lowConfidenceReason: valuation.lowConfidenceReason, comparablesUsed: usedListings, comparablesRejected: rejected,
    valuation, dataSource: 'manual', officialUrl: '', warning: 'Estimate uses listings you pasted manually. Verify them against the official Trade2 link before trading.',
  };
}
