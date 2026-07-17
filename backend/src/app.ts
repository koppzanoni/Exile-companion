import cors from "cors";
import express from "express";
import { createDatabase, type AppDatabase } from "./db.js";
import { message, safeSecret } from "./appHelpers.js";
import { installAuth } from "./auth.js";
import { installHealthRoutes } from "./routes/healthRoutes.js";
import { installPreferencesRoutes } from "./routes/preferencesRoutes.js";
import { installAccountPrivacyRoutes } from "./routes/accountPrivacyRoutes.js";
import { installPoeOAuthRoutes } from "./routes/poeOAuthRoutes.js";
import { installPublicProfileCatalogRoutes } from "./routes/publicProfileCatalogRoutes.js";
import { installItemCraftingRoutes } from "./routes/itemCraftingRoutes.js";
import { installAdminCatalogRoutes } from "./routes/adminCatalogRoutes.js";
import { installBuildDoctorRoutes } from "./routes/buildDoctorRoutes.js";
import { installGeminiRoutes } from "./routes/geminiRoutes.js";
import { installCharacterLoadoutRoutes } from "./routes/characterLoadoutRoutes.js";
import { installShoppingPurchaseEvolutionRoutes } from "./routes/shoppingPurchaseEvolutionRoutes.js";
import { installAlertsMonitorWorkerRoutes } from "./routes/alertsMonitorWorkerRoutes.js";
import { installSalesFeedbackRoutes } from "./routes/salesFeedbackRoutes.js";
import { installTradeRoutes } from "./routes/tradeRoutes.js";
import { installAnalyzeMarketHistoryRoutes } from "./routes/analyzeMarketHistoryRoutes.js";
import { installChecksRoutes } from "./routes/checksRoutes.js";
import { installSettingsBuildProfileRoutes } from "./routes/settingsBuildProfileRoutes.js";
import { installLevelingRoutes } from "./routes/levelingRoutes.js";
import { installRaceReviewsRoutes } from "./routes/raceReviewsRoutes.js";
import { installCharactersCrudRoutes } from "./routes/charactersCrudRoutes.js";

export function createApp(db: AppDatabase = createDatabase()) {
  const app = express();
  if(process.env.TRUST_PROXY_HOPS)app.set('trust proxy',Math.max(0,Number(process.env.TRUST_PROXY_HOPS)||0));
  app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Cross-Origin-Resource-Policy','same-site');next();});
  const configuredOrigins = process.env.FRONTEND_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin:
        !configuredOrigins?.length || configuredOrigins.includes("*")
          ? true
          : configuredOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  installAuth(app, db);
  app.use("/api", (req, res, next) => {
    const userId = res.locals.user?.userId as number | undefined;
    if (!userId) return next();
    const pathConnection = req.path.match(
        /^\/poe\/(?:characters|oauth\/connections)\/(\d+)/,
      )?.[1],
      bodyConnection = req.path.match(/^\/characters\/\d+\/reconcile$/)
        ? req.body?.connectionId
        : undefined,
      connectionId = Number(pathConnection || bodyConnection || 0);
    if (
      connectionId &&
      !db
        .prepare("SELECT 1 FROM poe_oauth_connections WHERE id=? AND user_id=?")
        .get(connectionId, userId)
    )
      return res.status(404).json({ error: "Connection not found." });
    next();
  });
  app.use("/api", (req, res, next) => {
    const userId = res.locals.user?.userId as number | undefined;
    if (!userId) return next();
    const characterMatch = req.path.match(/^\/characters\/(\d+)/);
    if (
      characterMatch &&
      !db
        .prepare("SELECT 1 FROM characters WHERE id=? AND user_id=?")
        .get(characterMatch[1], userId)
    )
      return res.status(404).json({ error: "Character not found." });
    const ownedResources: [RegExp, string][] = [
      [
        /^\/shopping-plan\/(\d+)/,
        "SELECT 1 FROM shopping_plan_items p JOIN characters c ON c.id=p.character_id WHERE p.id=? AND c.user_id=?",
      ],
      [
        /^\/purchases\/(\d+)/,
        "SELECT 1 FROM purchase_transactions p JOIN characters c ON c.id=p.character_id WHERE p.id=? AND c.user_id=?",
      ],
      [
        /^\/replacement-sales\/(\d+)/,
        "SELECT 1 FROM replacement_sale_drafts p JOIN characters c ON c.id=p.character_id WHERE p.id=? AND c.user_id=?",
      ],
      [
        /^\/alerts\/(\d+)/,
        "SELECT 1 FROM character_alerts a JOIN characters c ON c.id=a.character_id WHERE a.id=? AND c.user_id=?",
      ],
      [
        /^\/sales\/(\d+)/,
        "SELECT 1 FROM sale_journal WHERE id=? AND user_id=?",
      ],
      [
        /^\/monitor-jobs\/(\d+)/,
        "SELECT 1 FROM monitor_jobs j JOIN characters c ON c.id=j.character_id WHERE j.id=? AND c.user_id=?",
      ],
    ];
    for (const [pattern, sql] of ownedResources) {
      const match = req.path.match(pattern);
      if (match && !db.prepare(sql).get(match[1], userId))
        return res.status(404).json({ error: "Resource not found." });
    }
    next();
  });
  const rateBuckets = new Map<string, { start: number; count: number }>();
  app.use("/api", (req, res, next) => {
    if (
      req.path === "/health" ||
      req.path === "/health/detailed" ||
      req.path === "/poe/oauth/callback" ||
      req.path === "/worker/tick"
    )
      return next();
    const expected = process.env.APP_ACCESS_TOKEN;
    if (expected && !safeSecret(req.header("x-app-token") || "", expected))
      return res
        .status(401)
        .json({ error: "Application access token required." });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      process.env.APP_CSRF_TOKEN &&
      !safeSecret(req.header("x-csrf-token") || "", process.env.APP_CSRF_TOKEN)
    )
      return res.status(403).json({ error: "Invalid CSRF token." });
    const key = req.ip || "unknown",
      now = Date.now(),
      windowMs = 60_000,
      limit = Math.max(
        10,
        Number(process.env.API_RATE_LIMIT_PER_MINUTE || 180),
      );
    let bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      rateBuckets.set(key, bucket);
    }
    if(rateBuckets.size>10_000)for(const [bucketKey,value] of rateBuckets)if(now-value.start>windowMs)rateBuckets.delete(bucketKey);
    bucket.count++;
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, limit - bucket.count)),
    );
    if (bucket.count > limit)
      return res
        .status(429)
        .json({ error: "Rate limit exceeded. Try again shortly." });
    next();
  });
  app.use((req, res, next) => {
    const started = performance.now();
    res.on("finish", () => {
      if (req.path === "/api/health") return;
      try {
        db.prepare(
          "INSERT INTO request_audit(method,route,status,duration_ms) VALUES (?,?,?,?)",
        ).run(
          req.method,
          req.path.replace(/\/\d+(?=\/|$)/g, "/:id"),
          res.statusCode,
          Math.round((performance.now() - started) * 100) / 100,
        );
        db.prepare(
          "DELETE FROM request_audit WHERE created_at<datetime('now','-30 days')",
        ).run();
      } catch {}
    });
    next();
  });

  installHealthRoutes(app, db);
  installPreferencesRoutes(app, db);
  installAccountPrivacyRoutes(app, db);
  installPoeOAuthRoutes(app, db);
  installPublicProfileCatalogRoutes(app, db);
  installItemCraftingRoutes(app, db);
  installAdminCatalogRoutes(app, db);
  installBuildDoctorRoutes(app, db);
  installGeminiRoutes(app, db);
  installCharacterLoadoutRoutes(app, db);
  installShoppingPurchaseEvolutionRoutes(app, db);
  installAlertsMonitorWorkerRoutes(app, db);
  installSalesFeedbackRoutes(app, db);
  installTradeRoutes(app, db);
  installAnalyzeMarketHistoryRoutes(app, db);
  installChecksRoutes(app, db);
  installSettingsBuildProfileRoutes(app, db);
  installLevelingRoutes(app, db);
  installRaceReviewsRoutes(app, db);
  installCharactersCrudRoutes(app, db);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => res.status(500).json({ error: message(err) }),
  );
  return app;
}
