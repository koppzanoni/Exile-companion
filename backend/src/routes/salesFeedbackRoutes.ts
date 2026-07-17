import type { Express } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db.js';
import { adviseSale } from '../saleAdvisor.js';
import { characterOwnedByUser } from '../appHelpers.js';

const saleSchema = z.object({
  checkId: z.number().int().positive().optional(),
  itemName: z.string().trim().min(1).max(200),
  league: z.string().trim().min(1).max(100),
  listedPrice: z.number().positive().max(1000000),
  currency: z.enum(['exalted', 'divine']),
  notes: z.string().max(1000).optional(),
});

export function installSalesFeedbackRoutes(app: Express, db: AppDatabase): void {
  app.post('/api/recommendation-feedback', (req, res) => {
    const parsed = z
      .object({
        checkId: z.number().int().positive().optional(),
        characterId: z.number().int().positive().optional(),
        verdict: z.enum(['useful', 'incorrect', 'bought', 'sold', 'no-results', 'wrong-price']),
        note: z.string().max(1000).optional(),
        outcome: z.record(z.unknown()).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid feedback.' });
    if (parsed.data.characterId && !characterOwnedByUser(db, parsed.data.characterId, res.locals.user?.userId))
      return res.status(404).json({ error: 'Character not found.' });
    const row = db
      .prepare(
        'INSERT INTO recommendation_feedback(check_id,character_id,verdict,note,outcome_json) VALUES (?,?,?,?,?)',
      )
      .run(
        parsed.data.checkId ?? null,
        parsed.data.characterId ?? null,
        parsed.data.verdict,
        parsed.data.note ?? null,
        parsed.data.outcome ? JSON.stringify(parsed.data.outcome) : null,
      );
    return res.status(201).json({ id: Number(row.lastInsertRowid) });
  });

  app.get('/api/sales', (_req, res) => {
    const userId = res.locals.user?.userId;
    return res.json({
      sales: userId
        ? db
            .prepare(
              'SELECT id,check_id AS checkId,item_name AS itemName,league,status,listed_price AS listedPrice,currency,final_price AS finalPrice,listed_at AS listedAt,sold_at AS soldAt,notes,updated_at AS updatedAt FROM sale_journal WHERE user_id=? ORDER BY updated_at DESC',
            )
            .all(userId)
        : db
            .prepare(
              'SELECT id,check_id AS checkId,item_name AS itemName,league,status,listed_price AS listedPrice,currency,final_price AS finalPrice,listed_at AS listedAt,sold_at AS soldAt,notes,updated_at AS updatedAt FROM sale_journal ORDER BY updated_at DESC',
            )
            .all(),
    });
  });
  app.get('/api/sales/advice', (_req, res) => {
    const userId = res.locals.user?.userId;
    const rows = (
      userId
        ? db
            .prepare(
              'SELECT s.id,s.status,s.listed_price AS listedPrice,s.listed_at AS listedAt,s.updated_at AS updatedAt,(SELECT COUNT(*)-1 FROM sale_price_history h WHERE h.sale_id=s.id) AS priceChanges FROM sale_journal s WHERE s.user_id=? ORDER BY s.updated_at DESC',
            )
            .all(userId)
        : db
            .prepare(
              'SELECT s.id,s.status,s.listed_price AS listedPrice,s.listed_at AS listedAt,s.updated_at AS updatedAt,(SELECT COUNT(*)-1 FROM sale_price_history h WHERE h.sale_id=s.id) AS priceChanges FROM sale_journal s ORDER BY s.updated_at DESC',
            )
            .all()
    ) as Array<any>;
    return res.json({
      advice: rows.map((row) => adviseSale(row)),
      basis: 'Local listing age and price history only; no completed sale is inferred.',
    });
  });
  app.post('/api/sales', (req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid sale entry.' });
    const row = db
      .prepare(
        'INSERT INTO sale_journal(check_id,item_name,league,status,listed_price,currency,notes,user_id) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(
        parsed.data.checkId ?? null,
        parsed.data.itemName,
        parsed.data.league,
        'listed',
        parsed.data.listedPrice,
        parsed.data.currency,
        parsed.data.notes || '',
        res.locals.user?.userId ?? null,
      );
    const id = Number(row.lastInsertRowid);
    db.prepare('INSERT INTO sale_price_history(sale_id,price,currency) VALUES (?,?,?)').run(
      id,
      parsed.data.listedPrice,
      parsed.data.currency,
    );
    return res.status(201).json({ id });
  });
  app.put('/api/sales/:id', (req, res) => {
    const parsed = z
      .object({
        status: z.enum(['listed', 'sold', 'withdrawn']).optional(),
        price: z.number().positive().optional(),
        finalPrice: z.number().positive().optional(),
        notes: z.string().max(1000).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid sale update.' });
    const current = db.prepare('SELECT * FROM sale_journal WHERE id=?').get(req.params.id) as any;
    if (!current) return res.status(404).json({ error: 'Sale not found.' });
    const price = parsed.data.price ?? current.listed_price;
    db.prepare(
      'UPDATE sale_journal SET status=?,listed_price=?,final_price=?,sold_at=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
    ).run(
      parsed.data.status ?? current.status,
      price,
      parsed.data.finalPrice ?? current.final_price,
      parsed.data.status === 'sold' && !current.sold_at ? new Date().toISOString() : current.sold_at,
      parsed.data.notes ?? current.notes,
      req.params.id,
    );
    if (parsed.data.price && parsed.data.price !== current.listed_price)
      db.prepare('INSERT INTO sale_price_history(sale_id,price,currency) VALUES (?,?,?)').run(
        req.params.id,
        parsed.data.price,
        current.currency,
      );
    return res.json({ ok: true });
  });
}
