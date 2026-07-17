import type { Express } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db.js';
import { getSettings } from '../db.js';
import { genericBuildFitProfile } from '../buildProfiles.js';
import { diagnoseBuild } from '../buildDoctor.js';
import { mergeItem, parseItemText } from '../itemParser.js';
import { ClipboardItemParser } from '../normalizedItemParser.js';
import { runMarketPipeline } from '../marketPipeline.js';
import { compareUpgradeCandidates } from '../upgradePlanner.js';
import {
  characterEvolutionData,
  csvCell,
  getActiveBuildProfile,
  getCharacterRow,
  listingToItemText,
  message,
  readCharacterLoadout,
  resolveBuildFitProfile,
} from '../appHelpers.js';

export function installShoppingPurchaseEvolutionRoutes(app: Express, db: AppDatabase): void {
  app.get('/api/characters/:id/shopping-plan', (req, res) =>
    res.json({
      items: db
        .prepare(
          "SELECT id,slot,reason,priority,suggested_budget AS suggestedBudget,status,listing_id AS listingId,item_text AS itemText,price,trade_url AS tradeUrl,score_delta AS scoreDelta,updated_at AS updatedAt FROM shopping_plan_items WHERE character_id=? ORDER BY CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,id",
        )
        .all(req.params.id),
    }),
  );
  app.put('/api/shopping-plan/:id', (req, res) => {
    const parsed = z
      .object({
        status: z.enum(['searching', 'candidate', 'bought', 'discarded']),
        note: z.string().max(500).optional(),
        listingId: z.string().max(200).optional(),
        itemText: z.string().max(20000).optional(),
        price: z.number().nonnegative().optional(),
        tradeUrl: z.string().url().optional(),
        scoreDelta: z.number().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid shopping plan update.' });
    const current = db.prepare('SELECT status FROM shopping_plan_items WHERE id=?').get(req.params.id) as
      { status: string } | undefined;
    if (!current) return res.status(404).json({ error: 'Shopping plan item not found.' });
    db.prepare(
      'UPDATE shopping_plan_items SET status=?,listing_id=COALESCE(?,listing_id),item_text=COALESCE(?,item_text),price=COALESCE(?,price),trade_url=COALESCE(?,trade_url),score_delta=COALESCE(?,score_delta),updated_at=CURRENT_TIMESTAMP WHERE id=?',
    ).run(
      parsed.data.status,
      parsed.data.listingId ?? null,
      parsed.data.itemText ?? null,
      parsed.data.price ?? null,
      parsed.data.tradeUrl ?? null,
      parsed.data.scoreDelta ?? null,
      req.params.id,
    );
    db.prepare('INSERT INTO shopping_plan_history(plan_item_id,from_status,to_status,note) VALUES (?,?,?,?)').run(
      req.params.id,
      current.status,
      parsed.data.status,
      parsed.data.note ?? null,
    );
    return res.json({ ok: true });
  });
  app.post('/api/shopping-plan/:id/equip', (req, res) => {
    const parsed = z
      .object({
        confirmed: z.literal(true),
        createSaleDraft: z.boolean().default(true),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: 'Explicit confirmation is required before equipping a purchased item.',
      });
    const plan = db
      .prepare(
        'SELECT id,character_id AS characterId,slot,status,item_text AS itemText,price FROM shopping_plan_items WHERE id=?',
      )
      .get(req.params.id) as
      | {
          id: number;
          characterId: number;
          slot: string;
          status: string;
          itemText: string | null;
          price: number | null;
        }
      | undefined;
    if (!plan) return res.status(404).json({ error: 'Shopping plan item not found.' });
    if (plan.status !== 'candidate' || !plan.itemText || plan.price === null)
      return res.status(409).json({ error: 'Save a priced candidate before equipping it.' });
    const character = getCharacterRow(db, plan.characterId);
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const equipment = db
      .prepare('SELECT slot,item_text AS itemText FROM character_equipment WHERE character_id=?')
      .all(character.id) as Array<{ slot: string; itemText: string }>;
    const build = character.buildProfileId
      ? resolveBuildFitProfile(db, character.buildProfileId)
      : getActiveBuildProfile(db) || genericBuildFitProfile;
    if (!build) return res.status(422).json({ error: 'Build profile not found.' });
    const before = diagnoseBuild(equipment, build);
    const old = equipment.find((item) => item.slot === plan.slot)?.itemText || null;
    const next = [...equipment.filter((item) => item.slot !== plan.slot), { slot: plan.slot, itemText: plan.itemText }];
    const after = diagnoseBuild(next, build);
    if (after.profile.overallScore < before.profile.overallScore)
      return res.status(409).json({
        error: 'Current data now classifies this candidate as a downgrade. Re-run the search before buying.',
      });
    db.exec('BEGIN');
    try {
      db.prepare(
        'INSERT INTO character_snapshots(character_id,patch,score,diagnosis_json,equipment_json) VALUES (?,?,?,?,?)',
      ).run(
        character.id,
        readCharacterLoadout(db, character.id)?.patch || 'unknown',
        before.profile.overallScore,
        JSON.stringify(before),
        JSON.stringify(equipment),
      );
      db.prepare(
        'INSERT INTO character_equipment(character_id,slot,item_text,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(character_id,slot) DO UPDATE SET item_text=excluded.item_text,updated_at=CURRENT_TIMESTAMP',
      ).run(character.id, plan.slot, plan.itemText);
      const purchase = db
        .prepare(
          'INSERT INTO purchase_transactions(character_id,plan_item_id,slot,price,currency,score_before,score_after,old_item_text,new_item_text) VALUES (?,?,?,?,?,?,?,?,?)',
        )
        .run(
          character.id,
          plan.id,
          plan.slot,
          plan.price,
          'exalted',
          before.profile.overallScore,
          after.profile.overallScore,
          old,
          plan.itemText,
        );
      const purchaseId = Number(purchase.lastInsertRowid);
      db.prepare("UPDATE shopping_plan_items SET status='bought',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(plan.id);
      db.prepare(
        "INSERT INTO shopping_plan_history(plan_item_id,from_status,to_status,note) VALUES (?,'candidate','bought','Equipped after explicit confirmation')",
      ).run(plan.id);
      db.prepare(
        'UPDATE characters SET budget=MAX(0,COALESCE(budget,0)-?),updated_at=CURRENT_TIMESTAMP WHERE id=?',
      ).run(plan.price, character.id);
      if (parsed.data.createSaleDraft && old)
        db.prepare('INSERT INTO replacement_sale_drafts(character_id,purchase_id,slot,item_text) VALUES (?,?,?,?)').run(
          character.id,
          purchaseId,
          plan.slot,
          old,
        );
      db.exec('COMMIT');
      return res.json({
        purchaseId,
        scoreBefore: before.profile.overallScore,
        scoreAfter: after.profile.overallScore,
        scoreDelta: after.profile.overallScore - before.profile.overallScore,
        budgetRemaining: Math.max(0, (character.budget || 0) - plan.price),
        saleDraftCreated: Boolean(parsed.data.createSaleDraft && old),
      });
    } catch (error) {
      db.exec('ROLLBACK');
      return res.status(500).json({ error: message(error) });
    }
  });
  app.get('/api/characters/:id/purchase-history', (req, res) => {
    const purchases = db
      .prepare(
        'SELECT id,plan_item_id AS planItemId,slot,price,currency,score_before AS scoreBefore,score_after AS scoreAfter,reversed_at AS reversedAt,reversal_reason AS reversalReason,created_at AS createdAt FROM purchase_transactions WHERE character_id=? ORDER BY created_at DESC',
      )
      .all(req.params.id) as Array<any>;
    const active = purchases.filter((row) => !row.reversedAt);
    const totalSpent = active.reduce((sum, row) => sum + row.price, 0);
    const totalScoreGain = active.reduce((sum, row) => sum + (row.scoreAfter - row.scoreBefore), 0);
    return res.json({
      purchases,
      totalSpent,
      totalScoreGain,
      costPerScore: totalScoreGain > 0 ? Math.round((totalSpent / totalScoreGain) * 100) / 100 : null,
    });
  });
  app.get('/api/characters/:id/evolution', (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const rows = db
      .prepare(
        'SELECT id,patch,score,diagnosis_json AS diagnosisJson,created_at AS createdAt FROM character_snapshots WHERE character_id=? ORDER BY created_at',
      )
      .all(character.id) as Array<any>;
    const snapshots = rows.flatMap((row) => {
      try {
        const diagnosis = JSON.parse(row.diagnosisJson);
        return [
          {
            id: row.id,
            patch: row.patch,
            score: row.score,
            createdAt: row.createdAt,
            resistances: diagnosis.resistances?.current || {},
            spirit: diagnosis.spirit?.current ?? 0,
            defences: diagnosis.defenceByType || {},
          },
        ];
      } catch {
        return [];
      }
    });
    const purchases = db
      .prepare(
        'SELECT id,slot,price,score_before AS scoreBefore,score_after AS scoreAfter,reversed_at AS reversedAt,created_at AS createdAt FROM purchase_transactions WHERE character_id=? ORDER BY created_at',
      )
      .all(character.id) as Array<any>;
    const active = purchases.filter((row) => !row.reversedAt);
    const best =
      active
        .slice()
        .sort(
          (a, b) =>
            (b.scoreAfter - b.scoreBefore) / Math.max(b.price, 0.01) -
            (a.scoreAfter - a.scoreBefore) / Math.max(a.price, 0.01),
        )[0] || null;
    const worst =
      active
        .slice()
        .sort(
          (a, b) =>
            (a.scoreAfter - a.scoreBefore) / Math.max(a.price, 0.01) -
            (b.scoreAfter - b.scoreBefore) / Math.max(b.price, 0.01),
        )[0] || null;
    return res.json({
      snapshots,
      purchases,
      bestPurchase: best,
      worstPurchase: worst,
      currentBudget: character.budget,
      patches: [...new Set(snapshots.map((row) => row.patch))],
    });
  });
  app.get('/api/characters/:id/evolution-filtered', (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    return res.json(
      characterEvolutionData(
        db,
        character,
        typeof req.query.patch === 'string' ? req.query.patch : undefined,
        typeof req.query.from === 'string' ? req.query.from : undefined,
        typeof req.query.to === 'string' ? req.query.to : undefined,
      ),
    );
  });
  app.get('/api/characters/:id/evolution.csv', (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).send('Character not found.');
    const data = characterEvolutionData(
      db,
      character,
      typeof req.query.patch === 'string' ? req.query.patch : undefined,
      typeof req.query.from === 'string' ? req.query.from : undefined,
      typeof req.query.to === 'string' ? req.query.to : undefined,
    );
    const lines = [
      'date,patch,score,spirit,fire,cold,lightning,chaos',
      ...data.snapshots.map((row: any) =>
        [
          row.createdAt,
          row.patch,
          row.score,
          row.spirit,
          row.resistances.fireResistance || 0,
          row.resistances.coldResistance || 0,
          row.resistances.lightningResistance || 0,
          row.resistances.chaosResistance || 0,
        ]
          .map(csvCell)
          .join(','),
      ),
    ];
    res.type('text/csv').setHeader('Content-Disposition', `attachment; filename="${character.name}-evolution.csv"`);
    return res.send(lines.join('\n'));
  });
  app.get('/api/characters/:id/net-upgrade-costs', (req, res) => {
    const rate = getSettings(db).divineToExalted;
    const purchases = db
      .prepare(
        'SELECT id,slot,price,score_before AS scoreBefore,score_after AS scoreAfter,reversed_at AS reversedAt FROM purchase_transactions WHERE character_id=? ORDER BY id DESC',
      )
      .all(req.params.id) as Array<any>;
    const sales = db
      .prepare(
        'SELECT purchase_id AS purchaseId,status,listed_price AS listedPrice,final_price AS finalPrice,currency FROM sale_journal WHERE purchase_id IS NOT NULL',
      )
      .all() as Array<any>;
    const rows = purchases.map((purchase) => {
      const sale = sales.find((row) => row.purchaseId === purchase.id);
      const confirmedReturn =
        sale?.status === 'sold' && sale.finalPrice
          ? Number(sale.finalPrice) * (sale.currency === 'divine' ? rate : 1)
          : 0;
      const netCost = purchase.reversedAt ? 0 : purchase.price - confirmedReturn;
      const scoreGain = purchase.scoreAfter - purchase.scoreBefore;
      return {
        ...purchase,
        saleStatus: sale?.status || 'not-listed',
        confirmedReturn,
        netCost,
        costPerScore: scoreGain > 0 ? Math.round((netCost / scoreGain) * 100) / 100 : null,
      };
    });
    return res.json({
      rows,
      warning: 'Net cost subtracts only confirmed sold prices; open listings contribute zero.',
    });
  });
  app.post('/api/purchases/:id/reverse', (req, res) => {
    const parsed = z
      .object({
        confirmed: z.literal(true),
        reason: z.string().trim().min(1).max(500),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: 'Explicit confirmation and a reversal reason are required.',
      });
    const purchase = db
      .prepare(
        'SELECT id,character_id AS characterId,plan_item_id AS planItemId,slot,price,old_item_text AS oldItemText,new_item_text AS newItemText,reversed_at AS reversedAt FROM purchase_transactions WHERE id=?',
      )
      .get(req.params.id) as any;
    if (!purchase) return res.status(404).json({ error: 'Purchase not found.' });
    if (purchase.reversedAt) return res.status(409).json({ error: 'Purchase was already reversed.' });
    if (!purchase.oldItemText) return res.status(409).json({ error: 'There is no previous equipped item to restore.' });
    const current = db
      .prepare('SELECT item_text AS itemText FROM character_equipment WHERE character_id=? AND slot=?')
      .get(purchase.characterId, purchase.slot) as { itemText: string } | undefined;
    if (!current || current.itemText !== purchase.newItemText)
      return res.status(409).json({
        error:
          'Current equipment no longer matches this purchase. Reversal was blocked to avoid overwriting a newer item.',
      });
    const activeSale = db
      .prepare("SELECT id FROM sale_journal WHERE purchase_id=? AND status IN ('listed','sold')")
      .get(purchase.id);
    if (activeSale)
      return res.status(409).json({
        error: 'The replaced item is already listed or sold. Withdraw it before reversing the equipment change.',
      });
    const character = getCharacterRow(db, purchase.characterId);
    const equipment = db
      .prepare('SELECT slot,item_text AS itemText FROM character_equipment WHERE character_id=?')
      .all(purchase.characterId) as Array<{ slot: string; itemText: string }>;
    const build = character?.buildProfileId
      ? resolveBuildFitProfile(db, character.buildProfileId)
      : getActiveBuildProfile(db) || genericBuildFitProfile;
    if (!character || !build) return res.status(422).json({ error: 'Character build could not be resolved.' });
    const before = diagnoseBuild(equipment, build);
    db.exec('BEGIN');
    try {
      db.prepare(
        'INSERT INTO character_snapshots(character_id,patch,score,diagnosis_json,equipment_json) VALUES (?,?,?,?,?)',
      ).run(
        character.id,
        readCharacterLoadout(db, character.id)?.patch || 'unknown',
        before.profile.overallScore,
        JSON.stringify(before),
        JSON.stringify(equipment),
      );
      db.prepare(
        'UPDATE character_equipment SET item_text=?,updated_at=CURRENT_TIMESTAMP WHERE character_id=? AND slot=?',
      ).run(purchase.oldItemText, character.id, purchase.slot);
      db.prepare('UPDATE characters SET budget=COALESCE(budget,0)+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(
        purchase.price,
        character.id,
      );
      db.prepare('UPDATE purchase_transactions SET reversed_at=CURRENT_TIMESTAMP,reversal_reason=? WHERE id=?').run(
        parsed.data.reason,
        purchase.id,
      );
      if (purchase.planItemId)
        db.prepare("UPDATE shopping_plan_items SET status='candidate',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(
          purchase.planItemId,
        );
      db.prepare("DELETE FROM replacement_sale_drafts WHERE purchase_id=? AND status='needs-price'").run(purchase.id);
      db.exec('COMMIT');
      return res.json({ ok: true, refunded: purchase.price });
    } catch (error) {
      db.exec('ROLLBACK');
      return res.status(500).json({ error: message(error) });
    }
  });
  app.get('/api/characters/:id/replacement-sales', (req, res) =>
    res.json({
      drafts: db
        .prepare(
          'SELECT id,purchase_id AS purchaseId,slot,item_text AS itemText,status,created_at AS createdAt FROM replacement_sale_drafts WHERE character_id=? ORDER BY created_at DESC',
        )
        .all(req.params.id),
    }),
  );
  app.post('/api/replacement-sales/:id/list', (req, res) => {
    const parsed = z
      .object({
        price: z.number().positive(),
        currency: z.enum(['exalted', 'divine']),
        league: z.string().min(1).max(100),
        notes: z.string().max(1000).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'A confirmed listing price is required.' });
    const draft = db
      .prepare(
        'SELECT id,purchase_id AS purchaseId,item_text AS itemText,status FROM replacement_sale_drafts WHERE id=?',
      )
      .get(req.params.id) as { id: number; purchaseId: number; itemText: string; status: string } | undefined;
    if (!draft) return res.status(404).json({ error: 'Sale draft not found.' });
    if (draft.status !== 'needs-price') return res.status(409).json({ error: 'Sale draft was already listed.' });
    const parsedItem = parseItemText(draft.itemText);
    const itemName = parsedItem.name || parsedItem.baseType || 'Replaced item';
    const sale = db
      .prepare(
        'INSERT INTO sale_journal(purchase_id,item_name,league,status,listed_price,currency,notes) VALUES (?,?,?,?,?,?,?)',
      )
      .run(
        draft.purchaseId,
        itemName,
        parsed.data.league,
        'listed',
        parsed.data.price,
        parsed.data.currency,
        parsed.data.notes || 'Created from a confirmed character upgrade.',
      );
    db.prepare("UPDATE replacement_sale_drafts SET status='listed',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(
      draft.id,
    );
    return res.status(201).json({ saleId: Number(sale.lastInsertRowid) });
  });
  app.get('/api/characters/:id/market-candidates/:slot', async (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const equipment = db
      .prepare('SELECT slot,item_text AS itemText FROM character_equipment WHERE character_id=?')
      .all(character.id) as Array<{ slot: string; itemText: string }>;
    const equipped = equipment.find((item) => item.slot === req.params.slot);
    if (!equipped)
      return res.status(404).json({
        error: 'Save an equipped item in this slot before searching.',
      });
    const build = character.buildProfileId
      ? resolveBuildFitProfile(db, character.buildProfileId)
      : getActiveBuildProfile(db) || genericBuildFitProfile;
    if (!build) return res.status(422).json({ error: 'Build profile not found.' });
    try {
      const item = mergeItem(parseItemText(equipped.itemText), {});
      const normalized = new ClipboardItemParser().parseClipboard(equipped.itemText, {
        league: character.league,
        patch: readCharacterLoadout(db, character.id)?.patch || 'unknown',
      });
      const market = await runMarketPipeline({
        item,
        itemAnalysis: normalized,
        build,
        league: character.league,
        divineRate: getSettings(db).divineToExalted,
      });
      const inputs = market.comparablesUsed.slice(0, 15).map((listing) => ({
        id: listing.id,
        slot: req.params.slot,
        itemText: listingToItemText(listing),
        price: listing.exaltedPrice,
        currency: 'exalted' as const,
      }));
      const ranked = compareUpgradeCandidates(equipment, inputs, build).filter((candidate) => candidate.scoreDelta > 0);
      return res.json({
        candidates: ranked.map((candidate) => ({
          ...candidate,
          itemText: inputs.find((input) => input.id === candidate.id)?.itemText,
          listing: market.comparablesUsed.find((row) => row.id === candidate.id),
        })),
        dataSource: market.dataSource,
        sampleSize: market.usedCount,
        warning: market.warning,
        officialUrl: market.officialUrl,
      });
    } catch (error) {
      return res.status(502).json({ error: message(error) });
    }
  });
  app.post('/api/shopping-plan/:id/monitor', async (req, res) => {
    const plan = db
      .prepare(
        'SELECT id,character_id AS characterId,slot,listing_id AS listingId,price,item_text AS itemText,status FROM shopping_plan_items WHERE id=?',
      )
      .get(req.params.id) as any;
    if (!plan) return res.status(404).json({ error: 'Shopping plan item not found.' });
    if (!['searching', 'candidate'].includes(plan.status))
      return res.status(409).json({ error: 'Only active shopping items can be monitored.' });
    const character = getCharacterRow(db, plan.characterId);
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const equipment = db
      .prepare('SELECT slot,item_text AS itemText FROM character_equipment WHERE character_id=?')
      .all(character.id) as Array<{ slot: string; itemText: string }>;
    const equipped = equipment.find((row) => row.slot === plan.slot);
    const build = character.buildProfileId
      ? resolveBuildFitProfile(db, character.buildProfileId)
      : getActiveBuildProfile(db) || genericBuildFitProfile;
    if (!equipped || !build) return res.status(422).json({ error: 'Equipped slot or build profile is missing.' });
    try {
      const item = mergeItem(parseItemText(equipped.itemText), {});
      const normalized = new ClipboardItemParser().parseClipboard(equipped.itemText, {
        league: character.league,
        patch: readCharacterLoadout(db, character.id)?.patch || 'unknown',
      });
      const market = await runMarketPipeline({
        item,
        itemAnalysis: normalized,
        build,
        league: character.league,
        divineRate: getSettings(db).divineToExalted,
      });
      const current = market.comparablesUsed.find((row) => row.id === plan.listingId);
      const inputs = market.comparablesUsed.slice(0, 15).map((row) => ({
        id: row.id,
        slot: plan.slot,
        itemText: listingToItemText(row),
        price: row.exaltedPrice,
        currency: 'exalted' as const,
      }));
      const best = compareUpgradeCandidates(equipment, inputs, build).filter(
        (row) => row.scoreDelta > 0 && !row.newGaps.length,
      )[0];
      const events: Array<{
        type: string;
        message: string;
        oldPrice?: number;
        newPrice?: number;
      }> = [];
      if (plan.listingId && !current)
        events.push({
          type: 'listing-unavailable',
          message: `Saved ${plan.slot} listing is no longer in the current comparable results.`,
        });
      if (current && plan.price !== null && current.exaltedPrice !== plan.price)
        events.push({
          type: 'price-changed',
          message: `${plan.slot} candidate changed from ${plan.price} to ${current.exaltedPrice} Exalted.`,
          oldPrice: plan.price,
          newPrice: current.exaltedPrice,
        });
      if (best && best.id !== plan.listingId && (plan.price === null || best.price <= plan.price))
        events.push({
          type: 'better-candidate',
          message: `A better ${plan.slot} candidate is available at ${best.price} Exalted with +${best.scoreDelta} score.`,
        });
      for (const event of events) {
        db.prepare(
          'INSERT INTO market_monitor_events(character_id,plan_item_id,event_type,old_price,new_price,details_json) VALUES (?,?,?,?,?,?)',
        ).run(
          character.id,
          plan.id,
          event.type,
          event.oldPrice ?? null,
          event.newPrice ?? null,
          JSON.stringify({ message: event.message, best }),
        );
        db.prepare(
          'INSERT INTO character_alerts(character_id,type,severity,message,metadata_json) VALUES (?,?,?,?,?)',
        ).run(
          character.id,
          event.type,
          event.type === 'listing-unavailable' ? 'warning' : 'info',
          event.message,
          JSON.stringify({ planItemId: plan.id, best }),
        );
      }
      return res.json({
        checkedAt: new Date().toISOString(),
        events,
        bestCandidate: best || null,
        dataSource: market.dataSource,
        sampleSize: market.usedCount,
        warning: market.warning,
      });
    } catch (error) {
      return res.status(502).json({ error: message(error) });
    }
  });
}
