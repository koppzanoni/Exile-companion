import type { Express } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db.js';
import { message, monitorShoppingItem } from '../appHelpers.js';

export function installAlertsMonitorWorkerRoutes(app: Express, db: AppDatabase): void {
  app.get('/api/characters/:id/alerts', (req, res) =>
    res.json({
      alerts: db
        .prepare(
          'SELECT id,type,severity,message,metadata_json AS metadataJson,read_at AS readAt,created_at AS createdAt FROM character_alerts WHERE character_id=? ORDER BY created_at DESC LIMIT 100',
        )
        .all(req.params.id),
    }),
  );
  app.put('/api/alerts/:id/read', (req, res) => {
    const result = db.prepare('UPDATE character_alerts SET read_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    return result.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Alert not found.' });
  });
  app.get('/api/characters/:id/calibration', (req, res) => {
    const rows = db
      .prepare(
        'SELECT id,slot,patch,predicted_delta AS predictedDelta,actual_delta AS actualDelta,absolute_error AS absoluteError,created_at AS createdAt FROM recommendation_calibration WHERE character_id=? ORDER BY created_at DESC',
      )
      .all(req.params.id) as Array<any>;
    const averageError = rows.length ? rows.reduce((sum, row) => sum + row.absoluteError, 0) / rows.length : 0;
    const bySlot = Object.values(
      rows.reduce((acc: Record<string, any>, row) => {
        const value = acc[row.slot] || {
          slot: row.slot,
          count: 0,
          totalError: 0,
        };
        value.count++;
        value.totalError += row.absoluteError;
        acc[row.slot] = value;
        return acc;
      }, {}),
    ).map((row: any) => ({
      ...row,
      averageError: Math.round((row.totalError / row.count) * 100) / 100,
      confidence: row.count >= 3 && row.totalError / row.count <= 2 ? 'High' : row.count >= 2 ? 'Medium' : 'Low',
    }));
    return res.json({
      sampleSize: rows.length,
      averageError: Math.round(averageError * 100) / 100,
      bySlot,
      rows,
      limitation: 'Calibration reflects only confirmed local purchases for this character and patch history.',
    });
  });
  app.get('/api/characters/:id/monitor-jobs', (req, res) =>
    res.json({
      jobs: db
        .prepare(
          'SELECT id,plan_item_id AS planItemId,enabled,interval_minutes AS intervalMinutes,next_run_at AS nextRunAt,last_run_at AS lastRunAt,last_status AS lastStatus,last_error AS lastError FROM monitor_jobs WHERE character_id=? ORDER BY id',
        )
        .all(req.params.id),
    }),
  );
  app.post('/api/characters/:id/monitor-jobs', (req, res) => {
    const parsed = z
      .object({
        planItemId: z.number().int().positive(),
        enabled: z.boolean().default(false),
        intervalMinutes: z.number().int().min(15).max(1440).default(60),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid monitor job.' });
    const plan = db
      .prepare('SELECT id FROM shopping_plan_items WHERE id=? AND character_id=?')
      .get(parsed.data.planItemId, req.params.id);
    if (!plan) return res.status(404).json({ error: 'Shopping plan item not found for this character.' });
    const result = db
      .prepare(
        "INSERT INTO monitor_jobs(character_id,plan_item_id,enabled,interval_minutes,next_run_at) VALUES (?,?,?,?,datetime('now',?))",
      )
      .run(
        req.params.id,
        parsed.data.planItemId,
        parsed.data.enabled ? 1 : 0,
        parsed.data.intervalMinutes,
        `+${parsed.data.intervalMinutes} minutes`,
      );
    return res.status(201).json({ id: Number(result.lastInsertRowid) });
  });
  app.put('/api/monitor-jobs/:id', (req, res) => {
    const parsed = z
      .object({
        enabled: z.boolean(),
        intervalMinutes: z.number().int().min(15).max(1440),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid monitor settings.' });
    const result = db
      .prepare(
        "UPDATE monitor_jobs SET enabled=?,interval_minutes=?,next_run_at=CASE WHEN ? THEN datetime('now',?) ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(
        parsed.data.enabled ? 1 : 0,
        parsed.data.intervalMinutes,
        parsed.data.enabled ? 1 : 0,
        `+${parsed.data.intervalMinutes} minutes`,
        req.params.id,
      );
    return result.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Monitor job not found.' });
  });
  app.post('/api/monitor-jobs/run-due', async (req, res) => {
    if (process.env.WORKER_API_TOKEN && req.header('x-worker-token') !== process.env.WORKER_API_TOKEN)
      return res.status(401).json({ error: 'Invalid worker token.' });
    const due = db
      .prepare(
        'SELECT id,plan_item_id AS planItemId,interval_minutes AS intervalMinutes FROM monitor_jobs WHERE enabled=1 AND (next_run_at IS NULL OR next_run_at<=CURRENT_TIMESTAMP) ORDER BY next_run_at LIMIT 10',
      )
      .all() as Array<any>;
    const results = [];
    for (const job of due) {
      try {
        const result = await monitorShoppingItem(db, job.planItemId);
        db.prepare(
          "UPDATE monitor_jobs SET last_run_at=CURRENT_TIMESTAMP,last_status='ok',last_error=NULL,next_run_at=datetime('now',?),updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(`+${job.intervalMinutes} minutes`, job.id);
        results.push({ jobId: job.id, ok: true, events: result.events.length });
      } catch (error) {
        db.prepare(
          "UPDATE monitor_jobs SET last_run_at=CURRENT_TIMESTAMP,last_status='error',last_error=?,next_run_at=datetime('now',?),updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(message(error), `+${job.intervalMinutes} minutes`, job.id);
        results.push({ jobId: job.id, ok: false, error: message(error) });
      }
    }
    return res.json({ processed: results.length, results });
  });
  app.post('/api/worker/tick', async (req, res) => {
    if (process.env.WORKER_API_TOKEN && req.header('x-worker-token') !== process.env.WORKER_API_TOKEN)
      return res.status(401).json({ error: 'Invalid worker token.' });
    const workerId = String(req.header('x-worker-id') || `worker-${process.pid}`).slice(0, 100);
    db.prepare(
      "UPDATE monitor_jobs SET locked_at=NULL,locked_by=NULL WHERE locked_at<datetime('now','-15 minutes')",
    ).run();
    const candidates = db
      .prepare(
        'SELECT id FROM monitor_jobs WHERE enabled=1 AND locked_at IS NULL AND (next_run_at IS NULL OR next_run_at<=CURRENT_TIMESTAMP) ORDER BY next_run_at LIMIT 10',
      )
      .all() as Array<{ id: number }>;
    const claimed = [];
    for (const row of candidates) {
      const changed = db
        .prepare('UPDATE monitor_jobs SET locked_at=CURRENT_TIMESTAMP,locked_by=? WHERE id=? AND locked_at IS NULL')
        .run(workerId, row.id);
      if (changed.changes) claimed.push(row.id);
    }
    const results = [];
    for (const id of claimed) {
      const job = db
        .prepare(
          'SELECT id,plan_item_id AS planItemId,interval_minutes AS intervalMinutes,failure_count AS failureCount FROM monitor_jobs WHERE id=? AND locked_by=?',
        )
        .get(id, workerId) as any;
      if (!job) continue;
      try {
        const result = await monitorShoppingItem(db, job.planItemId);
        db.prepare(
          "UPDATE monitor_jobs SET last_run_at=CURRENT_TIMESTAMP,last_status='ok',last_error=NULL,failure_count=0,next_run_at=datetime('now',?),locked_at=NULL,locked_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(`+${job.intervalMinutes} minutes`, id);
        results.push({ jobId: id, ok: true, events: result.events.length });
      } catch (error) {
        const failures = job.failureCount + 1;
        const backoff = Math.min(1440, job.intervalMinutes * Math.pow(2, Math.min(failures, 5)));
        db.prepare(
          "UPDATE monitor_jobs SET last_run_at=CURRENT_TIMESTAMP,last_status='error',last_error=?,failure_count=?,next_run_at=datetime('now',?),locked_at=NULL,locked_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(message(error), failures, `+${backoff} minutes`, id);
        results.push({
          jobId: id,
          ok: false,
          backoffMinutes: backoff,
          error: message(error),
        });
      }
    }
    return res.json({ workerId, processed: results.length, results });
  });
  app.get('/api/characters/:id/notification-preferences', (req, res) => {
    const row = db
      .prepare(
        'SELECT price_change AS priceChange,unavailable,better_candidate AS betterCandidate,minimum_saving AS minimumSaving,minimum_score_gain AS minimumScoreGain,daily_digest AS dailyDigest,muted_until AS mutedUntil FROM notification_preferences WHERE character_id=?',
      )
      .get(req.params.id);
    return res.json({
      preferences: row || {
        priceChange: 1,
        unavailable: 1,
        betterCandidate: 1,
        minimumSaving: 1,
        minimumScoreGain: 1,
        dailyDigest: 0,
        mutedUntil: null,
      },
    });
  });
  app.put('/api/characters/:id/notification-preferences', (req, res) => {
    const parsed = z
      .object({
        priceChange: z.boolean(),
        unavailable: z.boolean(),
        betterCandidate: z.boolean(),
        minimumSaving: z.number().nonnegative(),
        minimumScoreGain: z.number().nonnegative(),
        dailyDigest: z.boolean(),
        mutedUntil: z.string().datetime().nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid notification preferences.' });
    const p = parsed.data;
    db.prepare(
      'INSERT INTO notification_preferences(character_id,price_change,unavailable,better_candidate,minimum_saving,minimum_score_gain,daily_digest,muted_until) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(character_id) DO UPDATE SET price_change=excluded.price_change,unavailable=excluded.unavailable,better_candidate=excluded.better_candidate,minimum_saving=excluded.minimum_saving,minimum_score_gain=excluded.minimum_score_gain,daily_digest=excluded.daily_digest,muted_until=excluded.muted_until,updated_at=CURRENT_TIMESTAMP',
    ).run(
      req.params.id,
      p.priceChange ? 1 : 0,
      p.unavailable ? 1 : 0,
      p.betterCandidate ? 1 : 0,
      p.minimumSaving,
      p.minimumScoreGain,
      p.dailyDigest ? 1 : 0,
      p.mutedUntil ?? null,
    );
    return res.json({ ok: true });
  });
}
