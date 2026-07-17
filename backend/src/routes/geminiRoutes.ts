import type { Express } from "express";
import { z } from "zod";
import type { AppDatabase } from "../db.js";
import { chatWithGemini, detectPromptInjection } from "../gemini.js";
import { genericBuildFitProfile } from "../buildProfiles.js";
import { diagnoseBuild } from "../buildDoctor.js";
import {
  buildGeminiCharacterContext,
  characterOwnedByUser,
  getActiveBuildProfile,
  getCharacterRow,
  message,
  resolveBuildFitProfile,
} from "../appHelpers.js";

export function installGeminiRoutes(app: Express, db: AppDatabase): void {
  const geminiAnonymousUsage = new Map<
    string,
    { date: string; messages: number; costUsd: number }
  >();
  app.post("/api/gemini/chat", async (req, res) => {
    const parsed = z
      .object({
        mode: z.enum(["build", "sale"]),
        language: z.enum(["en", "pt-BR"]).default("en"),
        message: z.string().trim().min(1).max(1000),
        context: z.record(z.unknown()),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              text: z.string().max(1800),
            }),
          )
          .max(8)
          .optional(),
        conversationId: z.number().int().positive().optional(),
        characterId: z.number().int().positive().optional(),
        checkId: z.number().int().positive().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: parsed.error.issues.map((issue) => issue.message).join(", "),
        });
    if (
      parsed.data.characterId &&
      !characterOwnedByUser(db, parsed.data.characterId, res.locals.user?.userId)
    )
      return res.status(404).json({ error: "Character not found." });
    const started = performance.now(),
      userId = res.locals.user?.userId as number | undefined,
      dailyLimit = Math.max(
        1,
        Number(process.env.GEMINI_DAILY_MESSAGE_LIMIT || 100),
      ),
      dailyBudget = Math.max(
        0,
        Number(process.env.GEMINI_DAILY_BUDGET_USD || 0),
      ),
      rate = Math.max(
        0,
        Number(process.env.GEMINI_ESTIMATED_USD_PER_MILLION_TOKENS || 0),
      ),
      inputText = JSON.stringify({
        message: parsed.data.message,
        context: parsed.data.context,
        history: parsed.data.history,
      }),
      flags = detectPromptInjection(
        `${parsed.data.message}\n${JSON.stringify(parsed.data.context)}`,
      );
    try {
      if (flags.length) {
        db.prepare(
          "INSERT INTO gemini_usage(user_id,character_id,status,input_chars,latency_ms,injection_flags_json) VALUES (?,?,?,?,?,?)",
        ).run(
          userId ?? null,
          parsed.data.characterId ?? null,
          "blocked-injection",
          inputText.length,
          Math.round(performance.now() - started),
          JSON.stringify(flags),
        );
        return res
          .status(400)
          .json({
            error:
              "Potential prompt injection detected in the request. Remove embedded instructions and try again.",
            code: "prompt_injection_detected",
          });
      }
      const today = new Date().toISOString().slice(0, 10);
      if (userId) {
        const usage = db
          .prepare(
            "SELECT COUNT(*) messages,COALESCE(SUM(estimated_cost_usd),0) cost FROM gemini_usage WHERE user_id=? AND created_at>=date('now')",
          )
          .get(userId) as { messages: number; cost: number };
        if (usage.messages >= dailyLimit)
          return res
            .status(429)
            .json({
              error: "Daily Gemini message limit reached.",
              limit: dailyLimit,
            });
        if (dailyBudget > 0 && usage.cost >= dailyBudget)
          return res
            .status(429)
            .json({
              error: "Daily Gemini budget reached.",
              budgetUsd: dailyBudget,
            });
      } else {
        const anonymousKey = req.ip || "unknown";
        let anonymousUsage = geminiAnonymousUsage.get(anonymousKey);
        if (!anonymousUsage || anonymousUsage.date !== today) {
          anonymousUsage = { date: today, messages: 0, costUsd: 0 };
          geminiAnonymousUsage.set(anonymousKey, anonymousUsage);
        }
        if (geminiAnonymousUsage.size > 10_000)
          for (const [bucketKey, value] of geminiAnonymousUsage)
            if (value.date !== today) geminiAnonymousUsage.delete(bucketKey);
        if (anonymousUsage.messages >= dailyLimit)
          return res
            .status(429)
            .json({
              error: "Daily Gemini message limit reached.",
              limit: dailyLimit,
            });
        if (dailyBudget > 0 && anonymousUsage.costUsd >= dailyBudget)
          return res
            .status(429)
            .json({
              error: "Daily Gemini budget reached.",
              budgetUsd: dailyBudget,
            });
      }
      let conversationId = parsed.data.conversationId;
      if (
        conversationId &&
        userId &&
        !db
          .prepare(
            "SELECT 1 FROM gemini_conversations WHERE id=? AND user_id=?",
          )
          .get(conversationId, userId)
      )
        return res.status(404).json({ error: "Conversation not found." });
      if (!conversationId) {
        const created = db
          .prepare(
            "INSERT INTO gemini_conversations(mode,character_id,check_id,title,user_id) VALUES (?,?,?,?,?)",
          )
          .run(
            parsed.data.mode,
            parsed.data.characterId ?? null,
            parsed.data.checkId ?? null,
            parsed.data.message.slice(0, 80),
            userId ?? null,
          );
        conversationId = Number(created.lastInsertRowid);
      }
      db.prepare(
        "INSERT INTO gemini_messages(conversation_id,role,text) VALUES (?,'user',?)",
      ).run(conversationId, parsed.data.message);
      const serverContext = parsed.data.characterId
          ? buildGeminiCharacterContext(db, parsed.data.characterId)
          : null,
        // Only reuse a prior assistant answer when the caller is explicitly continuing THAT
        // same conversation (parsed.data.conversationId, the client-supplied id, not the
        // possibly-freshly-created `conversationId` below) — otherwise a brand-new conversation
        // about an unrelated topic would silently inherit the last thing the AI said in some
        // other, earlier conversation for this character, presented as "deterministic" context.
        memory = parsed.data.characterId && parsed.data.conversationId
          ? db
              .prepare(
                "SELECT summary,updated_at AS updatedAt FROM character_ai_memory WHERE character_id=? AND source_conversation_id=?",
              )
              .get(parsed.data.characterId, parsed.data.conversationId)
          : null,
        result = await chatWithGemini({
          ...parsed.data,
          context: {
            clientContext: parsed.data.context,
            serverVerifiedCharacterContext: serverContext,
            previousAssistantMemory: memory,
          },
        }),
        // Use the model's own reported input/output character counts (full request payload +
        // system instruction; full structured JSON response) rather than re-deriving a smaller
        // estimate from only the raw client message/context — the latter systematically
        // undercounts whenever serverVerifiedCharacterContext/memory or the fuller response body
        // is present, which weakens the dailyBudget enforcement that reads this same estimate.
        inputCharsBilled = result.inputChars || inputText.length,
        outputCharsBilled = result.available ? result.outputChars : 0,
        estimatedTokens = Math.ceil((inputCharsBilled + outputCharsBilled) / 4),
        estimatedCost = (estimatedTokens / 1_000_000) * rate,
        model = result.available
          ? result.model
          : process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || null;
      if (result.available) {
        db.prepare(
          "INSERT INTO gemini_messages(conversation_id,role,text,metadata_json) VALUES (?,'assistant',?,?)",
        ).run(
          conversationId,
          result.result.answer,
          JSON.stringify(result.result),
        );
        if (parsed.data.characterId)
          db.prepare(
            "INSERT INTO character_ai_memory(character_id,summary,source_conversation_id) VALUES (?,?,?) ON CONFLICT(character_id) DO UPDATE SET summary=excluded.summary,source_conversation_id=excluded.source_conversation_id,updated_at=CURRENT_TIMESTAMP",
          ).run(
            parsed.data.characterId,
            result.result.answer.slice(0, 2000),
            conversationId,
          );
      }
      db.prepare(
        "INSERT INTO gemini_usage(user_id,conversation_id,character_id,model,status,input_chars,output_chars,estimated_tokens,estimated_cost_usd,latency_ms,injection_flags_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        userId ?? null,
        conversationId,
        parsed.data.characterId ?? null,
        model,
        result.available ? "ok" : result.reason,
        inputCharsBilled,
        outputCharsBilled,
        estimatedTokens,
        estimatedCost,
        Math.round(performance.now() - started),
        "[]",
      );
      db.prepare(
        "UPDATE gemini_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(conversationId);
      if (!userId) {
        const anonymousKey = req.ip || "unknown",
          anonymousUsage = geminiAnonymousUsage.get(anonymousKey);
        if (anonymousUsage) {
          anonymousUsage.messages += 1;
          anonymousUsage.costUsd += estimatedCost;
        }
      }
      const { inputChars: _inputChars, outputChars: _outputChars, ...resultForClient } = result as typeof result & { outputChars?: number };
      return res.json({
        ...resultForClient,
        conversationId,
        usage: {
          dailyLimit,
          dailyBudgetUsd: dailyBudget,
          estimatedCostUsd: estimatedCost,
        },
      });
    } catch (error) {
      return res.status(502).json({ error: message(error) });
    }
  });
  app.get("/api/gemini/usage", (_req, res) => {
    const userId = res.locals.user?.userId;
    if (!userId) return res.status(401).json({ error: "Sign in required." });
    const daily = db
        .prepare(
          "SELECT COUNT(*) requests,COALESCE(SUM(estimated_tokens),0) estimatedTokens,COALESCE(SUM(estimated_cost_usd),0) estimatedCostUsd,COALESCE(SUM(CASE WHEN status='blocked-injection' THEN 1 ELSE 0 END),0) blocked FROM gemini_usage WHERE user_id=? AND created_at>=date('now')",
        )
        .get(userId),
      recent = db
        .prepare(
          "SELECT model,status,estimated_tokens AS estimatedTokens,estimated_cost_usd AS estimatedCostUsd,latency_ms AS latencyMs,created_at AS createdAt FROM gemini_usage WHERE user_id=? ORDER BY id DESC LIMIT 25",
        )
        .all(userId);
    return res.json({
      daily,
      recent,
      pricingConfigured:
        Number(process.env.GEMINI_ESTIMATED_USD_PER_MILLION_TOKENS || 0) > 0,
    });
  });
  app.get("/api/gemini/conversations", (req, res) => {
    const characterId = req.query.characterId
        ? Number(req.query.characterId)
        : null,
      userId = res.locals.user?.userId;
    const rows = userId
      ? characterId
        ? db
            .prepare(
              "SELECT id,mode,title,character_id AS characterId,check_id AS checkId,updated_at AS updatedAt FROM gemini_conversations WHERE character_id=? AND user_id=? AND archived_at IS NULL ORDER BY updated_at DESC",
            )
            .all(characterId, userId)
        : db
            .prepare(
              "SELECT id,mode,title,character_id AS characterId,check_id AS checkId,updated_at AS updatedAt FROM gemini_conversations WHERE user_id=? AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 50",
            )
            .all(userId)
      : characterId
        ? db
            .prepare(
              "SELECT id,mode,title,character_id AS characterId,check_id AS checkId,updated_at AS updatedAt FROM gemini_conversations WHERE character_id=? AND archived_at IS NULL ORDER BY updated_at DESC",
            )
            .all(characterId)
        : db
            .prepare(
              "SELECT id,mode,title,character_id AS characterId,check_id AS checkId,updated_at AS updatedAt FROM gemini_conversations WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT 50",
            )
            .all();
    return res.json({ conversations: rows });
  });
  app.get("/api/gemini/conversations/:id", (req, res) => {
    const userId = res.locals.user?.userId;
    const conversation = userId
      ? db
          .prepare(
            "SELECT id,mode,title,character_id AS characterId,check_id AS checkId,updated_at AS updatedAt FROM gemini_conversations WHERE id=? AND user_id=?",
          )
          .get(req.params.id, userId)
      : db
          .prepare(
            "SELECT id,mode,title,character_id AS characterId,check_id AS checkId,updated_at AS updatedAt FROM gemini_conversations WHERE id=?",
          )
          .get(req.params.id);
    if (!conversation)
      return res.status(404).json({ error: "Conversation not found." });
    const messages = db
      .prepare(
        "SELECT id,role,text,metadata_json AS metadataJson,created_at AS createdAt FROM gemini_messages WHERE conversation_id=? ORDER BY id",
      )
      .all(req.params.id);
    return res.json({ conversation, messages });
  });
  app.patch("/api/gemini/conversations/:id", (req, res) => {
    const userId=res.locals.user?.userId,parsed=z.object({title:z.string().trim().min(1).max(100).optional(),archived:z.boolean().optional()}).refine(value=>value.title!==undefined||value.archived!==undefined).safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:"A title or archive state is required."});
    const owned=userId?db.prepare("SELECT id FROM gemini_conversations WHERE id=? AND user_id=?").get(req.params.id,userId):db.prepare("SELECT id FROM gemini_conversations WHERE id=?").get(req.params.id);
    if(!owned)return res.status(404).json({error:"Conversation not found."});
    if(parsed.data.title!==undefined)db.prepare("UPDATE gemini_conversations SET title=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(parsed.data.title,req.params.id);
    if(parsed.data.archived!==undefined)db.prepare("UPDATE gemini_conversations SET archived_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(parsed.data.archived?new Date().toISOString():null,req.params.id);
    return res.json({ok:true});
  });
  app.post("/api/gemini/tools/execute", async (req, res) => {
    const parsed = z
      .object({
        characterId: z.number().int().positive(),
        action: z.enum([
          "inspect_slot",
          "search_upgrade",
          "view_shopping_plan",
        ]),
        slot: z.string().max(50).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Invalid controlled tool request." });
    if (!characterOwnedByUser(db, parsed.data.characterId, res.locals.user?.userId))
      return res.status(404).json({ error: "Character not found." });
    const character = getCharacterRow(db, parsed.data.characterId);
    if (!character)
      return res.status(404).json({ error: "Character not found." });
    if (parsed.data.action === "view_shopping_plan")
      return res.json({
        action: parsed.data.action,
        result: db
          .prepare(
            "SELECT id,slot,status,priority,suggested_budget AS suggestedBudget,price,score_delta AS scoreDelta FROM shopping_plan_items WHERE character_id=? ORDER BY id",
          )
          .all(character.id),
        mutated: false,
      });
    const equipment = db
      .prepare(
        "SELECT slot,item_text AS itemText FROM character_equipment WHERE character_id=?",
      )
      .all(character.id) as Array<{ slot: string; itemText: string }>;
    if (parsed.data.action === "inspect_slot") {
      const build = character.buildProfileId
        ? resolveBuildFitProfile(db, character.buildProfileId)
        : getActiveBuildProfile(db) || genericBuildFitProfile;
      if (!build)
        return res.status(422).json({ error: "Build profile not found." });
      const diagnosis = diagnoseBuild(equipment, build);
      return res.json({
        action: parsed.data.action,
        result:
          diagnosis.slots.find((slot) => slot.slot === parsed.data.slot) ||
          null,
        mutated: false,
      });
    }
    return res
      .status(409)
      .json({
        error:
          "Live searches must be launched from the confirmed slot action in the UI.",
        confirmationRequired: true,
      });
  });
}
