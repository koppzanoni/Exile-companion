import type { Express } from 'express';
import type { AppDatabase } from '../db.js';
import { schemaIntegrity } from '../migrations.js';
import { oauthStatus } from '../poeOAuth.js';
import { requireAdmin } from '../appHelpers.js';

export function installHealthRoutes(app: Express, db: AppDatabase): void {
  app.get('/api/health', (_req, res) =>
    res.json({
      ok: true,
      service: 'poe2-orb-analyzer',
      timestamp: new Date().toISOString(),
    }),
  );
  app.get('/api/health/detailed', (_req, res) => {
    const integrity = schemaIntegrity(db);
    const oauth = oauthStatus(db);
    const recent = db
      .prepare(
        "SELECT COUNT(*) count,AVG(duration_ms) avgDuration,SUM(CASE WHEN status>=500 THEN 1 ELSE 0 END) errors FROM request_audit WHERE created_at>=datetime('now','-1 hour')",
      )
      .get();
    return res.status(integrity.ok ? 200 : 503).json({
      ok: integrity.ok,
      database: integrity,
      oauth: {
        configured: oauth.configured,
        connections: oauth.connections.length,
      },
      gemini: {
        configured: Boolean(process.env.GEMINI_API_KEY),
        enabled: process.env.GEMINI_ENABLED !== 'false',
      },
      requestsLastHour: recent,
    });
  });
  app.get('/api/service-status', (_req, res) => {
    const oauth = oauthStatus(db);
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY) && process.env.GEMINI_ENABLED !== 'false';
    return res.json({
      checkedAt: new Date().toISOString(),
      services: {
        database: { status: 'online', source: 'local integrity check', confidence: 'High' },
        poe: {
          status: !oauth.configured ? 'not-configured' : oauth.connections.length ? 'connected' : 'configured',
          source: 'GGG OAuth configuration',
          confidence: 'High',
        },
        gemini: {
          status: geminiConfigured ? 'configured' : 'not-configured',
          source: 'backend configuration',
          confidence: 'High',
        },
        trade2: { status: 'unknown', source: 'no live query was executed by this health check', confidence: 'Low' },
      },
    });
  });
  app.get('/api/metrics', (_req, res) =>
    res.json({
      routes: db
        .prepare(
          "SELECT route,method,COUNT(*) count,ROUND(AVG(duration_ms),2) avgMs,MAX(duration_ms) maxMs,SUM(CASE WHEN status>=400 THEN 1 ELSE 0 END) errors FROM request_audit WHERE created_at>=datetime('now','-24 hours') GROUP BY route,method ORDER BY count DESC",
        )
        .all(),
      jobs: db.prepare('SELECT last_status AS status,COUNT(*) count FROM monitor_jobs GROUP BY last_status').all(),
      generatedAt: new Date().toISOString(),
    }),
  );
  app.get('/api/admin/operations', (_req, res) => {
    if (!requireAdmin(db, res)) return;
    const jobs = db
        .prepare(
          "SELECT COUNT(*) total,SUM(CASE WHEN enabled=1 AND next_run_at<CURRENT_TIMESTAMP THEN 1 ELSE 0 END) overdue,SUM(CASE WHEN locked_at IS NOT NULL THEN 1 ELSE 0 END) locked,SUM(CASE WHEN last_status='error' THEN 1 ELSE 0 END) failing FROM monitor_jobs",
        )
        .get(),
      requests = db
        .prepare(
          "SELECT COUNT(*) total,ROUND(AVG(duration_ms),2) averageMs,SUM(CASE WHEN status>=500 THEN 1 ELSE 0 END) serverErrors FROM request_audit WHERE created_at>=datetime('now','-24 hours')",
        )
        .get(),
      gemini = db
        .prepare(
          "SELECT COUNT(*) requests,COALESCE(SUM(estimated_tokens),0) estimatedTokens,COALESCE(SUM(estimated_cost_usd),0) estimatedCostUsd,SUM(CASE WHEN status NOT IN ('ok','gemini_not_configured') THEN 1 ELSE 0 END) failures FROM gemini_usage WHERE created_at>=datetime('now','-24 hours')",
        )
        .get(),
      backups = db
        .prepare(
          'SELECT status,target,error,verified,created_at AS createdAt FROM backup_runs ORDER BY id DESC LIMIT 10',
        )
        .all();
    return res.json({
      jobs,
      requests,
      gemini,
      backups,
      database: schemaIntegrity(db),
      generatedAt: new Date().toISOString(),
    });
  });
}
