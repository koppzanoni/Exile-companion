import type { Express } from "express";
import { z } from "zod";
import type { AppDatabase } from "../db.js";
import {
  activatePatch,
  listCatalogVersions,
  rollbackToVersion,
  stagePatch,
  validateModifierCatalog,
} from "../patchUpdater.js";
import { skillMechanicProfileSchema } from "../skillMechanicProfiles.js";
import {
  loadActiveRosterCatalog,
  rosterCatalogSchema,
  validateRosterCatalog,
} from "../rosterCatalog.js";
import { assertPublicHttpsUrl, message, requireAdmin } from "../appHelpers.js";

export function installAdminCatalogRoutes(app: Express, db: AppDatabase): void {
  app.get("/api/admin/knowledge-status", (_req, res) => {
    const table = (name: string) =>
      (
        db.prepare(`SELECT COUNT(*) count FROM ${name}`).get() as {
          count: number;
        }
      ).count;
    const sources = db
      .prepare(
        "SELECT name,authority,last_success_at AS lastSuccessAt,last_error AS lastError,updated_at AS updatedAt FROM data_sources ORDER BY name",
      )
      .all();
    const patches = db
      .prepare(
        "SELECT patch,data_version AS dataVersion,source,confidence,deprecated,updated_at AS updatedAt FROM patch_versions ORDER BY updated_at DESC",
      )
      .all();
    return res.json({
      patches,
      sources,
      counts: {
        itemBases: table("item_bases"),
        modifiers: table("modifier_definitions"),
        modifierGroups: table("modifier_groups"),
        craftingRules: table("crafting_rules"),
        skills: table("skill_profiles"),
      },
      generatedAt: new Date().toISOString(),
    });
  });

  app.get("/api/admin/patch/versions", (_req, res) => {
    if (!requireAdmin(db, res)) return;
    return res.json({ versions: listCatalogVersions(db).filter((version) => version.dataset === "modifiers") });
  });
  app.post("/api/admin/patch/stage", async (req, res) => {
    if (!requireAdmin(db, res)) return;
    const parsed = z
      .object({
        patch: z.string().trim().min(1).max(30),
        dataVersion: z.string().trim().min(1).max(30),
        source: z.string().trim().min(1).max(300),
        modifiers: z.array(z.record(z.unknown())).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
    try {
      let raw: unknown = parsed.data.modifiers;
      if (!raw) {
        let sourceUrl: URL;
        try {
          sourceUrl = new URL(parsed.data.source);
        } catch {
          return res
            .status(400)
            .json({
              error:
                'Provide either an inline "modifiers" array or a valid https:// "source" URL to download from.',
            });
        }
        try {
          await assertPublicHttpsUrl(sourceUrl);
        } catch (error) {
          return res.status(400).json({ error: message(error) });
        }
        const response = await fetch(sourceUrl.toString(), {
          signal: AbortSignal.timeout(15_000),
          redirect: "manual",
        });
        if (!response.ok)
          return res
            .status(422)
            .json({
              error:
                response.type === "opaqueredirect"
                  ? "The patch source redirected to another URL; provide the final URL directly."
                  : `Could not download the patch source (HTTP ${response.status}).`,
            });
        try {
          raw = await response.json();
        } catch {
          return res
            .status(422)
            .json({ error: "The patch source did not return valid JSON." });
        }
      }
      const validated = validateModifierCatalog(raw);
      if (!validated.ok)
        return res
          .status(422)
          .json({
            error: "Patch schema validation failed.",
            details: validated.errors,
          });
      const staged = stagePatch(db, {
        patch: parsed.data.patch,
        dataVersion: parsed.data.dataVersion,
        source: parsed.data.source,
        entries: validated.entries,
      });
      return res.status(201).json({ version: staged });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
  app.post("/api/admin/patch/:id/activate", (req, res) => {
    if (!requireAdmin(db, res)) return;
    try {
      return res.json({ version: activatePatch(db, Number(req.params.id)) });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
  app.post("/api/admin/patch/:id/rollback", (req, res) => {
    if (!requireAdmin(db, res)) return;
    try {
      return res.json({
        version: rollbackToVersion(db, Number(req.params.id)),
      });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
  app.get("/api/roster", (_req,res)=>{const loaded=loadActiveRosterCatalog(db);return res.json(loaded);});
  app.post("/api/admin/roster/stage",(req,res)=>{
    if (!requireAdmin(db, res)) return;
    const parsed=rosterCatalogSchema.safeParse(req.body);if(!parsed.success)return res.status(422).json({error:"Roster catalog schema validation failed.",details:parsed.error.issues});
    const validated=validateRosterCatalog(parsed.data);if(!validated.ok)return res.status(422).json({error:"Roster catalog regression validation failed.",details:validated.errors});
    db.exec("BEGIN");try{db.prepare("INSERT OR REPLACE INTO roster_catalogs(patch,data_version,source,verified_at,confidence,checksum,payload_json) VALUES (?,?,?,?,?,?,?)").run(validated.catalog.patch,validated.catalog.dataVersion,validated.catalog.source,validated.catalog.verifiedAt,validated.catalog.confidence,validated.checksum,JSON.stringify(validated.catalog));const result=db.prepare("INSERT INTO catalog_versions(dataset,patch,data_version,source,status,entry_count,regression_json,compare_json) VALUES ('roster',?,?,?,?,?,?,?)").run(validated.catalog.patch,validated.catalog.dataVersion,validated.catalog.source,"staged",validated.catalog.entries.length,JSON.stringify({passed:true,issues:[]}),JSON.stringify({checksum:validated.checksum}));db.exec("COMMIT");return res.status(201).json({version:{id:Number(result.lastInsertRowid),dataset:"roster",status:"staged",checksum:validated.checksum}});}catch(error){db.exec("ROLLBACK");return res.status(422).json({error:message(error)});}
  });
  app.post("/api/admin/roster/:id/activate",(req,res)=>{if(!requireAdmin(db,res))return;const id=Number(req.params.id);const row=db.prepare("SELECT id,status FROM catalog_versions WHERE id=? AND dataset='roster'").get(id) as {id:number;status:string}|undefined;if(!row)return res.status(404).json({error:"Roster catalog was not found."});if(row.status!=="staged")return res.status(422).json({error:"Only a staged roster catalog can be activated."});db.exec("BEGIN");try{db.prepare("UPDATE catalog_versions SET status='deprecated',deprecated_at=CURRENT_TIMESTAMP WHERE dataset='roster' AND status='active'").run();db.prepare("UPDATE catalog_versions SET status='active',activated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);db.exec("COMMIT");return res.json({version:{id,status:"active"}});}catch(error){db.exec("ROLLBACK");return res.status(422).json({error:message(error)});}});
  app.post("/api/admin/roster/:id/rollback",(req,res)=>{if(!requireAdmin(db,res))return;const id=Number(req.params.id);const target=db.prepare("SELECT id FROM catalog_versions WHERE id=? AND dataset='roster' AND status='deprecated'").get(id);if(!target)return res.status(422).json({error:"Only a deprecated roster catalog can be restored."});db.exec("BEGIN");try{db.prepare("UPDATE catalog_versions SET status='rolled-back',deprecated_at=CURRENT_TIMESTAMP WHERE dataset='roster' AND status='active'").run();db.prepare("UPDATE catalog_versions SET status='active',activated_at=CURRENT_TIMESTAMP,deprecated_at=NULL WHERE id=?").run(id);db.exec("COMMIT");return res.json({version:{id,status:"active",rolledBack:true}});}catch(error){db.exec("ROLLBACK");return res.status(422).json({error:message(error)});}});

  app.post("/api/admin/skills/stage", (req, res) => {
    if (!requireAdmin(db, res)) return;
    const parsed = z.object({
      patch: z.string().trim().min(1).max(30), dataVersion: z.string().trim().min(1).max(60), source: z.string().trim().min(1).max(300),
      profiles: z.array(skillMechanicProfileSchema).min(1).max(500),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: "Skill profile schema validation failed.", details: parsed.error.issues });
    if (parsed.data.profiles.some((profile) => profile.patch !== parsed.data.patch || profile.dataVersion !== parsed.data.dataVersion))
      return res.status(422).json({ error: "Every skill profile must match the staged patch and data version." });
    db.exec("BEGIN");
    let id: number;
    try {
      const result = db.prepare("INSERT INTO catalog_versions(dataset,patch,data_version,source,status,entry_count,regression_json,compare_json) VALUES ('skills',?,?,?,?,?,?,?)")
        .run(parsed.data.patch, parsed.data.dataVersion, parsed.data.source, "staged", parsed.data.profiles.length, JSON.stringify({ passed: true, issues: [] }), JSON.stringify({ addedIds: parsed.data.profiles.map((profile) => profile.id), removedIds: [] }));
      const insert = db.prepare("INSERT OR REPLACE INTO skill_profiles(id,patch,data_version,source,confidence,profile_json) VALUES (?,?,?,?,?,?)");
      for (const profile of parsed.data.profiles) insert.run(profile.id, profile.patch, profile.dataVersion, parsed.data.source, profile.confidence, JSON.stringify(profile));
      id = Number(result.lastInsertRowid);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      return res.status(422).json({ error: message(error) });
    }
    return res.status(201).json({ version: { id, dataset: "skills", status: "staged", entryCount: parsed.data.profiles.length, activated: false } });
  });
  app.post("/api/admin/skills/:id/activate", (req, res) => {
    if (!requireAdmin(db, res)) return;
    const id = Number(req.params.id);
    const row = db.prepare("SELECT id,patch,data_version AS dataVersion,source,status,entry_count AS entryCount,regression_json AS regressionJson FROM catalog_versions WHERE id=? AND dataset='skills'").get(id) as any;
    if (!row) return res.status(404).json({ error: "Staged skill catalog was not found." });
    if (row.status !== "staged") return res.status(422).json({ error: "Only a staged skill catalog can be activated." });
    db.exec("BEGIN");
    try {
      db.prepare("UPDATE catalog_versions SET status='deprecated',deprecated_at=CURRENT_TIMESTAMP WHERE dataset='skills' AND status='active'").run();
      db.prepare("UPDATE catalog_versions SET status='active',activated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      return res.status(422).json({ error: message(error) });
    }
    return res.json({ version: { ...row, status: "active", activated: true } });
  });
  app.post("/api/admin/skills/:id/rollback", (req, res) => {
    if (!requireAdmin(db, res)) return;
    const id = Number(req.params.id);
    const target = db.prepare("SELECT id FROM catalog_versions WHERE id=? AND dataset='skills' AND status='deprecated'").get(id);
    if (!target) return res.status(422).json({ error: "Only a deprecated skill catalog can be restored." });
    db.exec("BEGIN");
    try {
      db.prepare("UPDATE catalog_versions SET status='deprecated',deprecated_at=CURRENT_TIMESTAMP WHERE dataset='skills' AND status='active'").run();
      db.prepare("UPDATE catalog_versions SET status='active',activated_at=CURRENT_TIMESTAMP,deprecated_at=NULL WHERE id=?").run(id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      return res.status(422).json({ error: message(error) });
    }
    return res.json({ version: { id, dataset: "skills", status: "active", rolledBack: true } });
  });
}
