import express from "express";
import { z } from "zod";
import type { AppDatabase } from "../db.js";

export function installRaceReviewsRoutes(app: express.Express, db: AppDatabase) {
  app.get("/api/race-reviews", (_req, res) => {
    const rows = db
      .prepare(
        "SELECT id, title, cause, lesson, item_category AS itemCategory, created_at AS createdAt FROM race_reviews ORDER BY id DESC LIMIT 50",
      )
      .all();
    return res.json({ reviews: rows });
  });
  app.post("/api/race-reviews", (req, res) => {
    const parsed = z
      .object({
        title: z.string().trim().min(1).max(100),
        cause: z.string().trim().min(1).max(500),
        lesson: z.string().trim().min(1).max(500),
        itemCategory: z.string().trim().max(50).optional().default(""),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: parsed.error.issues.map((issue) => issue.message).join(", "),
        });
    const result = db
      .prepare(
        "INSERT INTO race_reviews(title,cause,lesson,item_category) VALUES (?,?,?,?)",
      )
      .run(
        parsed.data.title,
        parsed.data.cause,
        parsed.data.lesson,
        parsed.data.itemCategory || null,
      );
    const review = db
      .prepare(
        "SELECT id, title, cause, lesson, item_category AS itemCategory, created_at AS createdAt FROM race_reviews WHERE id=?",
      )
      .get(result.lastInsertRowid);
    return res.status(201).json({ review });
  });
  app.delete("/api/race-reviews/:id", (req, res) => {
    const result = db
      .prepare("DELETE FROM race_reviews WHERE id=?")
      .run(req.params.id);
    return result.changes
      ? res.status(204).send()
      : res.status(404).json({ error: "Review not found." });
  });
}
