export interface MarketComparable {
  id: string;
  price: number;
  currency: 'exalted' | 'divine';
  divineRate: number;
  similarity: number;
  indexedAt?: string;
  listingType?: 'asking' | 'sold';
  baseType: string;
  corrupted?: boolean;
  account?: string;
  strategy?: string;
}
export interface ValuedComparable extends MarketComparable {
  exaltedPrice: number;
  ageDays: number | null;
  status: 'used' | 'rejected';
  rejectedReason?: string;
}
export interface MarketValuation {
  quickSell: number;
  fairPrice: number;
  listingPrice: number;
  lower: number;
  upper: number;
  currency: 'exalted';
  confidence: 'High' | 'Medium' | 'Low';
  confidenceScore: number;
  lowConfidenceReason?: string;
  sampleSize: number;
  usedCount: number;
  discardedCount: number;
  median: number;
  trimmedMean: number;
  q1: number;
  q3: number;
  iqr: number;
  minimumReliablePrice: number;
  centralPrice: number;
  maximumLikelyPrice: number;
  distinctSellers: number;
  medianListingAgeDays: number | null;
  averageSimilarity: number;
  outliers: ValuedComparable[];
  priceFixSuspects: ValuedComparable[];
  liquidity: 'unknown' | 'low' | 'medium' | 'high';
  liquidityBasis: string;
  comparablesUsed: ValuedComparable[];
  comparablesRejected: ValuedComparable[];
  warning: string;
  explanation: string[];
}

export function valueMarket(rows: MarketComparable[], expectedBase?: string): MarketValuation {
  const normalizedBase = expectedBase?.toLowerCase();
  const all: ValuedComparable[] = rows.map((row) => ({
    ...row,
    exaltedPrice: row.currency === 'divine' ? row.price * row.divineRate : row.price,
    ageDays: ageInDays(row.indexedAt),
    status: 'rejected' as const,
  }));
  const candidates = all.filter((row) => {
    if (!(row.price > 0)) {
      row.rejectedReason = 'Non-positive or missing price.';
      return false;
    }
    if (normalizedBase && row.baseType.toLowerCase() !== normalizedBase) {
      row.rejectedReason = 'Base type does not match the item being priced.';
      return false;
    }
    return true;
  });
  if (!candidates.length) return empty('No comparable listings were available.', all);

  const values = candidates.map((row) => row.exaltedPrice).sort((a, b) => a - b);
  const median = quantile(values, 0.5);
  const q1 = quantile(values, 0.25),
    q3 = quantile(values, 0.75);
  const iqr = Math.max(q3 - q1, median * 0.15);
  const lowBound = q1 - 1.5 * iqr,
    highBound = q3 + 1.5 * iqr;
  const accountCounts = new Map<string, number>();
  candidates.forEach((row) => row.account && accountCounts.set(row.account, (accountCounts.get(row.account) || 0) + 1));

  const outliers: ValuedComparable[] = [];
  const priceFixSuspects: ValuedComparable[] = [];
  const kept: ValuedComparable[] = [];
  for (const row of candidates) {
    if (row.exaltedPrice < Math.max(0.01, lowBound) || row.exaltedPrice > highBound) {
      row.rejectedReason = 'Statistical price outlier (outside the interquartile range).';
      outliers.push(row);
      continue;
    }
    if (row.account && (accountCounts.get(row.account) || 0) >= 3 && row.exaltedPrice < median * 0.65) {
      row.rejectedReason = 'Suspected price-fixing cluster (same seller repeatedly undercutting).';
      priceFixSuspects.push(row);
      continue;
    }
    kept.push(row);
  }

  let used = kept;
  let lowConfidenceReason: string | undefined;
  if (used.length < 2) {
    used = candidates;
    outliers.length = 0;
    priceFixSuspects.length = 0;
    candidates.forEach((row) => {
      row.rejectedReason = undefined;
    });
    lowConfidenceReason = 'Too few listings remained after removing outliers, so the full sample was used instead.';
  }
  used.forEach((row) => {
    row.status = 'used';
  });
  const rejected = all.filter((row) => row.status === 'rejected');

  const sortedUsed = [...used].sort((a, b) => a.exaltedPrice - b.exaltedPrice);
  const weighted = weightedMedian(
    sortedUsed.map((row) => ({
      value: row.exaltedPrice,
      weight: Math.max(0.05, row.similarity) * recency(row.indexedAt),
    })),
  );
  const usedValues = sortedUsed.map((row) => row.exaltedPrice);
  const trimmedMean = trimMean(usedValues, 0.1);
  const sellers = new Set(used.map((row) => row.account || row.id));
  const ages = used
    .map((row) => row.ageDays)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const medianAge = ages.length ? quantile(ages, 0.5) : null;
  const avgSimilarityFraction = average(used.map((row) => row.similarity));
  const avgSimilarity = Math.round(avgSimilarityFraction * 100);

  let confidenceScore = Math.min(100, Math.round(used.length * 6 + avgSimilarityFraction * 35));
  if (sellers.size <= 1) {
    confidenceScore = Math.min(confidenceScore, 40);
    lowConfidenceReason = lowConfidenceReason || 'All usable comparables come from a single seller.';
  }
  if (used.length < 3) {
    confidenceScore = Math.min(confidenceScore, 45);
    lowConfidenceReason = lowConfidenceReason || 'Fewer than three usable comparables were found.';
  }
  if (avgSimilarity < 55) {
    lowConfidenceReason = lowConfidenceReason || 'Average similarity of the usable comparables is low.';
  }
  const confidence = confidenceScore >= 75 ? 'High' : confidenceScore >= 45 ? 'Medium' : 'Low';
  const liquidity =
    sellers.size >= 5 && used.length >= 8
      ? 'high'
      : sellers.size >= 3 && used.length >= 4
        ? 'medium'
        : used.length
          ? 'low'
          : 'unknown';

  return {
    quickSell: round(weighted * 0.85),
    fairPrice: round(weighted),
    listingPrice: round(weighted * 1.12),
    lower: round(quantile(usedValues, 0.2)),
    upper: round(quantile(usedValues, 0.8)),
    currency: 'exalted',
    confidence,
    confidenceScore,
    lowConfidenceReason,
    sampleSize: kept.length || used.length,
    usedCount: used.length,
    discardedCount: rejected.length,
    median: round(median),
    trimmedMean: round(trimmedMean),
    q1: round(q1),
    q3: round(q3),
    iqr: round(iqr),
    minimumReliablePrice: round(quantile(usedValues, 0.2)),
    centralPrice: round(weighted),
    maximumLikelyPrice: round(quantile(usedValues, 0.8)),
    distinctSellers: sellers.size,
    medianListingAgeDays: medianAge === null ? null : Math.round(medianAge),
    averageSimilarity: avgSimilarity,
    outliers,
    priceFixSuspects,
    liquidity,
    liquidityBasis:
      'Approximated from active listing count and distinct sellers only; no confirmed sales were available.',
    comparablesUsed: sortedUsed,
    comparablesRejected: rejected,
    warning: rows.some((row) => row.listingType === 'sold')
      ? 'Includes completed-sale evidence where supplied.'
      : 'This estimate is based on asking prices, not completed sales.',
    explanation: [
      `${rows.length} listings received; ${used.length} used after base matching, similarity, and outlier checks.`,
      'Similarity and listing recency weight the median toward the most comparable, freshest listings.',
    ],
  };
}

function empty(warning: string, all: ValuedComparable[] = []): MarketValuation {
  return {
    quickSell: 0,
    fairPrice: 0,
    listingPrice: 0,
    lower: 0,
    upper: 0,
    currency: 'exalted',
    confidence: 'Low',
    confidenceScore: 0,
    lowConfidenceReason: warning,
    sampleSize: 0,
    usedCount: 0,
    discardedCount: all.length,
    median: 0,
    trimmedMean: 0,
    q1: 0,
    q3: 0,
    iqr: 0,
    minimumReliablePrice: 0,
    centralPrice: 0,
    maximumLikelyPrice: 0,
    distinctSellers: 0,
    medianListingAgeDays: null,
    averageSimilarity: 0,
    outliers: [],
    priceFixSuspects: [],
    liquidity: 'unknown',
    liquidityBasis: 'No listings were available to approximate liquidity.',
    comparablesUsed: [],
    comparablesRejected: all,
    warning,
    explanation: [],
  };
}
function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const p = (values.length - 1) * q;
  const lo = Math.floor(p),
    hi = Math.ceil(p);
  return values[lo] + (values[hi] - values[lo]) * (p - lo);
}
function weightedMedian(rows: Array<{ value: number; weight: number }>) {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  let seen = 0;
  for (const row of rows) {
    seen += row.weight;
    if (seen >= total / 2) return row.value;
  }
  return rows.at(-1)?.value || 0;
}
function trimMean(sorted: number[], trim: number) {
  if (!sorted.length) return 0;
  const cut = Math.floor(sorted.length * trim);
  const slice = sorted.slice(cut, sorted.length - cut);
  const use = slice.length ? slice : sorted;
  return use.reduce((a, b) => a + b, 0) / use.length;
}
function ageInDays(value?: string): number | null {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  return Number.isFinite(ms) ? Math.max(0, ms / 86400000) : null;
}
function recency(value?: string) {
  if (!value) return 0.65;
  const days = Math.max(0, (Date.now() - new Date(value).getTime()) / 86400000);
  return Math.max(0.2, Math.exp(-days / 14));
}
function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
const round = (value: number) => (value < 10 ? Math.round(value * 10) / 10 : Math.round(value));
