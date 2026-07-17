import express from "express";
import { z } from "zod";
import type { AppDatabase } from "../db.js";
import {
  getActiveBuildProfile,
  getCharacterRow,
  message,
  resolveBuildFitProfile,
  withTransaction,
} from "../appHelpers.js";
import { genericBuildFitProfile } from "../buildProfiles.js";
import { diagnoseBuild } from "../buildDoctor.js";
import { loadActiveRosterCatalog, rosterCompatibility } from "../rosterCatalog.js";

const characterSchema = z.object({
  name: z.string().trim().min(1).max(60),
  league: z.string().trim().min(1).max(100),
  level: z.number().int().min(1).max(100).optional(),
  className: z.string().trim().max(60).optional().default(""),
  ascendancy: z.string().trim().max(60).optional().default(""),
  buildProfileId: z.string().trim().max(100).optional().default(""),
  stage: z.enum(["campaign", "early-maps", "established", "transition", "endgame", "aspirational"]).optional(),
  budget: z.number().nonnegative().max(1000000).optional(),
  targetContent: z.string().trim().max(300).optional().default(""),
  currentIssues: z.string().trim().max(1000).optional().default(""),
});
const characterEquipmentSchema = z.object({
  equipment: z
    .array(
      z.object({
        slot: z.string().trim().min(1).max(50),
        itemText: z.string().max(20000),
      }),
    )
    .max(20),
});

export function installCharactersCrudRoutes(app: express.Express, db: AppDatabase) {
  app.get("/api/characters", (_req, res) => {
    const userId = res.locals.user?.userId;
    const rows = userId
      ? db
          .prepare(
            "SELECT id, name, league, level, class_name AS className, ascendancy, build_profile_id AS buildProfileId, stage, budget, target_content AS targetContent, current_issues AS currentIssues, updated_at AS updatedAt FROM characters WHERE user_id=? ORDER BY updated_at DESC",
          )
          .all(userId)
      : db
          .prepare(
            "SELECT id, name, league, level, class_name AS className, ascendancy, build_profile_id AS buildProfileId, stage, budget, target_content AS targetContent, current_issues AS currentIssues, updated_at AS updatedAt FROM characters ORDER BY updated_at DESC",
          )
          .all();
    return res.json({ characters: rows });
  });
  app.post("/api/characters", (req, res) => {
    const parsed = characterSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: parsed.error.issues.map((issue) => issue.message).join(", "),
        });
    const activeRoster=loadActiveRosterCatalog(db).catalog;const rosterEntry=activeRoster.entries.find((entry)=>entry.baseClass===parsed.data.className);const rosterCheck=rosterCompatibility(activeRoster,parsed.data.className,parsed.data.ascendancy,activeRoster.patch);if(rosterEntry&&(!rosterEntry.playable||rosterCheck.issues.some((issue)=>issue.includes("not catalogued"))))return res.status(422).json({error:rosterCheck.issues.join(" "),rosterCompatibility:rosterCheck});
    try {
      const result = db
        .prepare(
          "INSERT INTO characters(name, league, level, class_name, ascendancy, build_profile_id, stage, budget, target_content, current_issues,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          parsed.data.name,
          parsed.data.league,
          parsed.data.level ?? null,
          parsed.data.className,
          parsed.data.ascendancy,
          parsed.data.buildProfileId,
          parsed.data.stage ?? null,
          parsed.data.budget ?? null,
          parsed.data.targetContent,
          parsed.data.currentIssues,
          res.locals.user?.userId ?? null,
        );
      return res
        .status(201)
        .json({
          character: getCharacterRow(db, Number(result.lastInsertRowid)),
        });
    } catch (error) {
      return res.status(409).json({ error: message(error) });
    }
  });
  app.get("/api/characters/:id", (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character)
      return res.status(404).json({ error: "Character not found." });
    const equipment = db
      .prepare(
        "SELECT slot, item_text AS itemText FROM character_equipment WHERE character_id = ? ORDER BY slot",
      )
      .all(character.id) as Array<{ slot: string; itemText: string }>;
    const build = character.buildProfileId
      ? resolveBuildFitProfile(db, character.buildProfileId)
      : getActiveBuildProfile(db) || genericBuildFitProfile;
    const diagnosis =
      equipment.length && build ? diagnoseBuild(equipment, build) : null;
    const history = db
      .prepare(
        "SELECT h.id, h.check_id AS checkId, h.summary, h.created_at AS createdAt FROM character_analysis_history h WHERE h.character_id = ? ORDER BY h.created_at DESC LIMIT 25",
      )
      .all(character.id);
    return res.json({ character, equipment, diagnosis, history });
  });
  app.put("/api/characters/:id", (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character)
      return res.status(404).json({ error: "Character not found." });
    const parsed = characterSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: parsed.error.issues.map((issue) => issue.message).join(", "),
        });
    const activeRoster=loadActiveRosterCatalog(db).catalog;const rosterEntry=activeRoster.entries.find((entry)=>entry.baseClass===parsed.data.className);const rosterCheck=rosterCompatibility(activeRoster,parsed.data.className,parsed.data.ascendancy,activeRoster.patch);if(rosterEntry&&(!rosterEntry.playable||rosterCheck.issues.some((issue)=>issue.includes("not catalogued"))))return res.status(422).json({error:rosterCheck.issues.join(" "),rosterCompatibility:rosterCheck});
    try {
      db.prepare(
        "UPDATE characters SET name=?, league=?, level=?, class_name=?, ascendancy=?, build_profile_id=?, stage=?, budget=?, target_content=?, current_issues=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(
        parsed.data.name,
        parsed.data.league,
        parsed.data.level ?? null,
        parsed.data.className,
        parsed.data.ascendancy,
        parsed.data.buildProfileId,
        parsed.data.stage ?? null,
        parsed.data.budget ?? null,
        parsed.data.targetContent,
        parsed.data.currentIssues,
        character.id,
      );
      return res.json({ character: getCharacterRow(db, character.id) });
    } catch (error) {
      return res.status(409).json({ error: message(error) });
    }
  });
  app.put("/api/characters/:id/equipment", (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character)
      return res.status(404).json({ error: "Character not found." });
    const parsed = characterEquipmentSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: parsed.error.issues.map((issue) => issue.message).join(", "),
        });
    withTransaction(db, () => {
      const upsert = db.prepare(
        "INSERT INTO character_equipment(character_id, slot, item_text, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(character_id, slot) DO UPDATE SET item_text = excluded.item_text, updated_at = CURRENT_TIMESTAMP",
      );
      for (const entry of parsed.data.equipment)
        upsert.run(character.id, entry.slot, entry.itemText);
      db.prepare(
        "UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(character.id);
    });
    const equipment = db
      .prepare(
        "SELECT slot, item_text AS itemText FROM character_equipment WHERE character_id = ? ORDER BY slot",
      )
      .all(character.id) as Array<{ slot: string; itemText: string }>;
    return res.json({ equipment });
  });
  app.delete("/api/characters/:id", (req, res) => {
    const result = db
      .prepare("DELETE FROM characters WHERE id = ?")
      .run(req.params.id);
    return result.changes
      ? res.status(204).send()
      : res.status(404).json({ error: "Character not found." });
  });
}
