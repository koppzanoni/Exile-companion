import type Database from 'better-sqlite3';
import type { MarketValuation } from './marketValuationEngine.js';
import type { MarketDataSource } from './marketPipeline.js';

const VERIFIED_LIVE_SOURCES: MarketDataSource[] = ['live', 'relaxed-live'];

export function recordPriceSnapshot(
  db: Database.Database,
  params: {
    baseType: string;
    itemClass: string;
    league: string;
    dataSource: MarketDataSource;
    valuation: MarketValuation;
  },
) {
  if (!params.baseType || !VERIFIED_LIVE_SOURCES.includes(params.dataSource) || params.valuation.usedCount === 0)
    return;
  const { valuation } = params;
  const snapshot = {
    median: valuation.median,
    fairPrice: valuation.fairPrice,
    quickSell: valuation.quickSell,
    maximumLikelyPrice: valuation.maximumLikelyPrice,
    distinctSellers: valuation.distinctSellers,
    liquidity: valuation.liquidity,
    priceFixSuspectCount: valuation.priceFixSuspects.length,
  };
  db.prepare(
    'INSERT INTO price_estimates(patch, league, base_type, item_class, data_source, estimate_json, confidence, sample_size) VALUES (?,?,?,?,?,?,?,?)',
  ).run(
    'unknown',
    params.league,
    params.baseType,
    params.itemClass,
    params.dataSource,
    JSON.stringify(snapshot),
    valuation.confidenceScore,
    valuation.usedCount,
  );
}

export interface MarketSnapshot {
  id: number;
  baseType: string;
  itemClass: string;
  league: string;
  dataSource: MarketDataSource;
  median: number;
  fairPrice: number;
  quickSell: number;
  maximumLikelyPrice: number;
  sampleSize: number;
  distinctSellers: number;
  liquidity: 'unknown' | 'low' | 'medium' | 'high';
  priceFixSuspectCount: number;
  confidence: 'High' | 'Medium' | 'Low';
  createdAt: string;
}

export interface MarketHistoryResult {
  baseType: string;
  league: string;
  snapshots: MarketSnapshot[];
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
  changePercent: number | null;
  priceFixFlaggedSnapshots: number;
  limitations: string[];
}

function confidenceLabel(score: number): 'High' | 'Medium' | 'Low' {
  return score >= 75 ? 'High' : score >= 45 ? 'Medium' : 'Low';
}

export function getMarketHistory(
  db: Database.Database,
  baseType: string,
  league: string,
  limit = 30,
): MarketHistoryResult {
  const rows = db
    .prepare(
      'SELECT id, base_type AS baseType, item_class AS itemClass, league, data_source AS dataSource, estimate_json AS estimateJson, confidence, sample_size AS sampleSize, created_at AS createdAt FROM price_estimates WHERE base_type = ? AND league = ? ORDER BY created_at DESC, id DESC LIMIT ?',
    )
    .all(baseType, league, limit) as Array<{
    id: number;
    baseType: string;
    itemClass: string;
    league: string;
    dataSource: MarketDataSource;
    estimateJson: string;
    confidence: number;
    sampleSize: number;
    createdAt: string;
  }>;
  const snapshots: MarketSnapshot[] = rows.map((row) => {
    const est = JSON.parse(row.estimateJson) as {
      median: number;
      fairPrice: number;
      quickSell: number;
      maximumLikelyPrice: number;
      distinctSellers: number;
      liquidity: MarketSnapshot['liquidity'];
      priceFixSuspectCount: number;
    };
    return {
      id: row.id,
      baseType: row.baseType,
      itemClass: row.itemClass,
      league: row.league,
      dataSource: row.dataSource,
      sampleSize: row.sampleSize,
      createdAt: row.createdAt,
      confidence: confidenceLabel(row.confidence),
      ...est,
    };
  });
  const ascending = [...snapshots].reverse();
  let trend: MarketHistoryResult['trend'] = 'unknown';
  let changePercent: number | null = null;
  if (ascending.length >= 2 && ascending[0].median > 0) {
    changePercent =
      Math.round(((ascending[ascending.length - 1].median - ascending[0].median) / ascending[0].median) * 1000) / 10;
    trend = changePercent > 5 ? 'rising' : changePercent < -5 ? 'falling' : 'stable';
  }
  const priceFixFlaggedSnapshots = snapshots.filter((s) => s.priceFixSuspectCount > 0).length;
  const limitations = [
    'Snapshots are only recorded from live or relaxed-live Trade2 searches; manual, cached, or missing-data results are never added to this history.',
    'A snapshot reflects active listing prices at capture time, not confirmed sales — the absence of a listing does not prove low liquidity.',
    ...(snapshots.length < 2 ? ['Fewer than two snapshots are available yet, so no price trend can be computed.'] : []),
  ];
  return { baseType, league, snapshots, trend, changePercent, priceFixFlaggedSnapshots, limitations };
}
