import type { Express } from "express";
import { z } from "zod";
import type { AppDatabase } from "../db.js";
import { verifyAccountPassword } from "../auth.js";
import { getCharacterRow, readCharacterLoadout } from "../appHelpers.js";

export function installAccountPrivacyRoutes(app: Express, db: AppDatabase): void {
  app.post("/api/privacy/cleanup", (_req, res) => {
    const conversations = db
      .prepare(
        "DELETE FROM gemini_conversations WHERE updated_at<datetime('now','-90 days')",
      )
      .run().changes;
    const states = db
      .prepare(
        "DELETE FROM poe_oauth_states WHERE created_at<datetime('now','-10 minutes')",
      )
      .run().changes;
    return res.json({
      deletedConversations: conversations,
      deletedOAuthStates: states,
    });
  });
  app.get("/api/account/export", (_req, res) => {
    const userId = res.locals.user?.userId;
    if (!userId) return res.status(401).json({ error: "Sign in required." });
    const user = db
        .prepare(
          "SELECT id,email,display_name AS displayName,created_at AS createdAt FROM app_users WHERE id=?",
        )
        .get(userId),
      characters = db
        .prepare("SELECT * FROM characters WHERE user_id=? ORDER BY id")
        .all(userId) as Array<any>,
      characterIds = characters.map((row) => row.id),
      sales = db
        .prepare(
          "SELECT id,check_id AS checkId,item_name AS itemName,league,status,listed_price AS listedPrice,currency,final_price AS finalPrice,listed_at AS listedAt,sold_at AS soldAt,notes FROM sale_journal WHERE user_id=? ORDER BY id",
        )
        .all(userId),
      conversations = db
        .prepare(
          "SELECT id,mode,character_id AS characterId,title,created_at AS createdAt,updated_at AS updatedAt FROM gemini_conversations WHERE user_id=? ORDER BY id",
        )
        .all(userId) as Array<any>,
      oauth = db
        .prepare(
          "SELECT id,poe_username AS username,scope,last_sync_at AS lastSyncAt,created_at AS createdAt FROM poe_oauth_connections WHERE user_id=? ORDER BY id",
        )
        .all(userId);
    const equipment = characterIds.flatMap(
        (id) =>
          db
            .prepare(
              "SELECT character_id AS characterId,slot,item_text AS itemText,updated_at AS updatedAt FROM character_equipment WHERE character_id=?",
            )
            .all(id) as Array<any>,
      ),
      messages = conversations.flatMap(
        (row) =>
          db
            .prepare(
              "SELECT conversation_id AS conversationId,role,text,created_at AS createdAt FROM gemini_messages WHERE conversation_id=? ORDER BY id",
            )
            .all(row.id) as Array<any>,
      );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="exile-companion-account.json"',
    );
    return res.json({
      exportedAt: new Date().toISOString(),
      user,
      characters,
      equipment,
      sales,
      conversations,
      messages,
      oauthConnections: oauth,
    });
  });
  app.delete("/api/account", (req, res) => {
    const userId = res.locals.user?.userId,
      parsed = z
        .object({
          password: z.string().min(10),
          confirmation: z.literal("DELETE MY ACCOUNT"),
        })
        .safeParse(req.body);
    if (!userId) return res.status(401).json({ error: "Sign in required." });
    if (
      !parsed.success ||
      !verifyAccountPassword(db, userId, parsed.data.password)
    )
      return res
        .status(403)
        .json({
          error: "Password and exact deletion confirmation are required.",
        });
    db.prepare("DELETE FROM app_users WHERE id=?").run(userId);
    res.setHeader(
      "Set-Cookie",
      "exile_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    );
    return res.status(204).send();
  });
  app.get("/api/characters/:id/export", (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character)
      return res.status(404).json({ error: "Character not found." });
    return res.json({
      exportedAt: new Date().toISOString(),
      character,
      equipment: db
        .prepare(
          "SELECT slot,item_text AS itemText,updated_at AS updatedAt FROM character_equipment WHERE character_id=?",
        )
        .all(character.id),
      loadout: readCharacterLoadout(db, character.id),
      snapshots: db
        .prepare(
          "SELECT patch,score,diagnosis_json AS diagnosisJson,equipment_json AS equipmentJson,created_at AS createdAt FROM character_snapshots WHERE character_id=? ORDER BY created_at",
        )
        .all(character.id),
      purchases: db
        .prepare(
          "SELECT * FROM purchase_transactions WHERE character_id=? ORDER BY created_at",
        )
        .all(character.id),
      alerts: db
        .prepare(
          "SELECT * FROM character_alerts WHERE character_id=? ORDER BY created_at",
        )
        .all(character.id),
    });
  });
}
