import express from "express";
import type { AppDatabase } from "../db.js";
import { normalizeStoredResult } from "../appHelpers.js";

export function installChecksRoutes(app: express.Express, db: AppDatabase) {
  app.get("/api/checks", (_req, res) => {
    const rows = db
      .prepare(
        "SELECT id, league, item_json, result_json, data_source, official_url, warning, created_at FROM checks ORDER BY id DESC",
      )
      .all() as any[];
    res.json(
      rows.map((row) => {
        const stored = normalizeStoredResult(JSON.parse(row.result_json));
        return {
          id: row.id,
          league: row.league,
          item: JSON.parse(row.item_json),
          result: stored.estimate,
          evaluation: stored.evaluation,
          comparison: stored.comparison,
          craftingPotential: stored.craftingPotential,
          recommendation: stored.recommendation,
          marketAnalysis: stored.marketAnalysis,
          statValuation: stored.statValuation,
          equippedStatValuation: stored.equippedStatValuation,
          evaluations: stored.evaluations,
          decision: stored.decision,
          opportunity: stored.opportunity,
          beginnerSummary: stored.beginnerSummary,
          dataSource: row.data_source,
          officialUrl: row.official_url,
          warning: row.warning,
          createdAt: row.created_at,
        };
      }),
    );
  });

  app.get("/api/checks/:id", (req, res) => {
    const row = db
      .prepare("SELECT * FROM checks WHERE id = ?")
      .get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: "Saved check not found." });
    const comps = db
      .prepare(
        "SELECT listing_json, similarity, excluded_reason FROM comparable_listings WHERE check_id = ? ORDER BY similarity DESC",
      )
      .all(req.params.id) as any[];
    const stored = normalizeStoredResult(JSON.parse(row.result_json));
    return res.json({
      id: row.id,
      league: row.league,
      item: JSON.parse(row.item_json),
      result: stored.estimate,
      evaluation: stored.evaluation,
      comparison: stored.comparison,
      craftingPotential: stored.craftingPotential,
      recommendation: stored.recommendation,
      marketAnalysis: stored.marketAnalysis,
      statValuation: stored.statValuation,
      equippedStatValuation: stored.equippedStatValuation,
      evaluations: stored.evaluations,
      decision: stored.decision,
      opportunity: stored.opportunity,
      beginnerSummary: stored.beginnerSummary,
      dataSource: row.data_source,
      officialUrl: row.official_url,
      warning: row.warning,
      createdAt: row.created_at,
      comparableListings: comps.map((c) => ({
        ...JSON.parse(c.listing_json),
        similarity: c.similarity,
        excludedReason: c.excluded_reason,
      })),
    });
  });

  app.delete("/api/checks/:id", (req, res) => {
    const result = db
      .prepare("DELETE FROM checks WHERE id = ?")
      .run(req.params.id);
    if (!result.changes)
      return res.status(404).json({ error: "Saved check not found." });
    return res.status(204).send();
  });
}
