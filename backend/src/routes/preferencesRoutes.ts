import type { Express } from "express";
import { z } from "zod";
import type { AppDatabase } from "../db.js";

export function installPreferencesRoutes(app: Express, db: AppDatabase): void {
  app.get("/api/preferences", (_req, res) => {
    const userId = res.locals.user?.userId;
    if (!userId) return res.json({ persisted: false, activeCharacterId: null, language: "en", experienceMode: "beginner", onboardingStep: 0, onboardingComplete: false });
    const row = db.prepare("SELECT active_character_id AS activeCharacterId,language,experience_mode AS experienceMode,onboarding_step AS onboardingStep,onboarding_complete AS onboardingComplete FROM user_preferences WHERE user_id=?").get(userId) as Record<string,unknown>|undefined;
    return res.json({
      persisted: true,
      activeCharacterId: row?.activeCharacterId ?? null,
      language: row?.language ?? "en",
      experienceMode: row?.experienceMode ?? "beginner",
      onboardingStep: Number(row?.onboardingStep ?? 0),
      onboardingComplete: Boolean(row?.onboardingComplete),
    });
  });
  app.put("/api/preferences", (req, res) => {
    const userId = res.locals.user?.userId;
    if (!userId) return res.status(401).json({ error: "Sign in to synchronize preferences across devices." });
    const parsed = z.object({activeCharacterId:z.number().int().positive().nullable(),language:z.enum(["en","pt-BR"]),experienceMode:z.enum(["beginner","advanced"]),onboardingStep:z.number().int().min(0).max(9),onboardingComplete:z.boolean()}).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid preferences." });
    if (parsed.data.activeCharacterId && !db.prepare("SELECT 1 FROM characters WHERE id=? AND user_id=?").get(parsed.data.activeCharacterId,userId)) return res.status(404).json({ error: "Character not found." });
    db.prepare("INSERT INTO user_preferences(user_id,active_character_id,language,experience_mode,onboarding_step,onboarding_complete) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET active_character_id=excluded.active_character_id,language=excluded.language,experience_mode=excluded.experience_mode,onboarding_step=excluded.onboarding_step,onboarding_complete=excluded.onboarding_complete,updated_at=CURRENT_TIMESTAMP").run(userId,parsed.data.activeCharacterId,parsed.data.language,parsed.data.experienceMode,parsed.data.onboardingStep,parsed.data.onboardingComplete?1:0);
    return res.json({ persisted:true,...parsed.data });
  });
}
