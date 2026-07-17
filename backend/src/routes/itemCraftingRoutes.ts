import type { Express } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db.js';
import { ClipboardItemParser } from '../normalizedItemParser.js';
import { Poe2CraftingEngine } from '../craftingEngine.js';
import {
  applyAction,
  compareContinueSellBuy,
  legalActions,
  stateFromItem,
  type CraftingItemState,
} from '../craftingStateMachine.js';
import { craftingCurrencies } from '../craftingCurrencies.js';
import { characterOwnedByUser, message, riskRank } from '../appHelpers.js';

export function installItemCraftingRoutes(app: Express, db: AppDatabase): void {
  app.post('/api/item/normalize', (req, res) => {
    const parsed = z
      .object({
        text: z.string().min(1).max(100000),
        league: z.string().max(100).optional(),
        patch: z.string().max(30).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Paste valid PoE 2 item text.' });
    try {
      return res.json({
        item: new ClipboardItemParser().parseClipboard(parsed.data.text, {
          league: parsed.data.league,
          patch: parsed.data.patch,
        }),
      });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
  app.post('/api/crafting/plan', async (req, res) => {
    const parsed = z
      .object({
        text: z.string().min(1).max(100000),
        league: z.string().max(100).optional(),
        patch: z.string().max(30).optional(),
        goal: z.object({
          description: z.string().min(1).max(500),
          minimumItemLevel: z.number().int().positive().optional(),
          mandatoryGroups: z.array(z.string()).optional(),
          targetStats: z.record(z.number()).optional(),
          buyPrice: z.number().positive().optional(),
          currentValue: z.number().nonnegative().optional(),
        }),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Paste an item and enter a valid crafting goal.' });
    try {
      const item = new ClipboardItemParser().parseClipboard(parsed.data.text, {
        league: parsed.data.league,
        patch: parsed.data.patch,
      });
      const engine = new Poe2CraftingEngine();
      const state = engine.inspect(item);
      return res.json(await engine.plan(state, parsed.data.goal));
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
  app.post('/api/crafting/state', (req, res) => {
    const parsed = z
      .object({
        text: z.string().min(1).max(100000),
        league: z.string().max(100).optional(),
        patch: z.string().max(30).optional(),
        goal: z
          .object({
            description: z.string().min(1).max(500),
            minimumItemLevel: z.number().int().positive().optional(),
            mandatoryGroups: z.array(z.string()).optional(),
            targetStats: z.record(z.number()).optional(),
            buyPrice: z.number().positive().optional(),
            currentValue: z.number().nonnegative().optional(),
          })
          .optional(),
        estimatedValue: z.number().nonnegative().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Paste an item to inspect its crafting state.' });
    try {
      const item = new ClipboardItemParser().parseClipboard(parsed.data.text, {
        league: parsed.data.league,
        patch: parsed.data.patch,
      });
      const state = stateFromItem(item, parsed.data.goal, parsed.data.estimatedValue);
      return res.json({
        state,
        legalActions: legalActions(state),
        currencies: craftingCurrencies,
      });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
  app.post('/api/crafting/apply', (req, res) => {
    const parsed = z
      .object({
        state: z.record(z.unknown()),
        currencyId: z.string().trim().min(1).max(60),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide a crafting state and a currency id.' });
    try {
      const { state: nextState, evaluation } = applyAction(
        parsed.data.state as unknown as CraftingItemState,
        parsed.data.currencyId,
      );
      return res.json({
        state: nextState,
        evaluation,
        legalActions: legalActions(nextState),
      });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
  app.post('/api/crafting/compare', (req, res) => {
    const parsed = z
      .object({
        state: z.record(z.unknown()),
        sellValue: z.number().nonnegative().optional(),
        buyPrice: z.number().nonnegative().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide a crafting state to compare.' });
    try {
      return res.json(
        compareContinueSellBuy(parsed.data.state as unknown as CraftingItemState, {
          sellValue: parsed.data.sellValue,
          buyPrice: parsed.data.buyPrice,
        }),
      );
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
  app.post('/api/crafting/history', (req, res) => {
    const parsed = z
      .object({
        characterId: z.number().int().positive().optional(),
        action: z.string().trim().min(1).max(100),
        before: z.record(z.unknown()),
        after: z.record(z.unknown()),
        valueBefore: z.number().optional(),
        valueAfter: z.number().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
    if (parsed.data.characterId && !characterOwnedByUser(db, parsed.data.characterId, res.locals.user?.userId))
      return res.status(404).json({ error: 'Character not found.' });
    const gainLoss =
      parsed.data.valueBefore !== undefined && parsed.data.valueAfter !== undefined
        ? Math.round((parsed.data.valueAfter - parsed.data.valueBefore) * 100) / 100
        : null;
    const afterState = parsed.data.after as { currencySpent?: unknown[] };
    const result = db
      .prepare(
        'INSERT INTO crafting_history(character_id,action,before_json,after_json,currency_spent_count,value_before,value_after,gain_loss) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(
        parsed.data.characterId ?? null,
        parsed.data.action,
        JSON.stringify(parsed.data.before),
        JSON.stringify(parsed.data.after),
        Array.isArray(afterState.currencySpent) ? afterState.currencySpent.length : 0,
        parsed.data.valueBefore ?? null,
        parsed.data.valueAfter ?? null,
        gainLoss,
      );
    return res.status(201).json({ id: Number(result.lastInsertRowid), gainLoss });
  });
  app.get('/api/crafting/history', (req, res) => {
    const characterId = req.query.characterId ? Number(req.query.characterId) : undefined;
    const rows = (
      characterId
        ? db
            .prepare(
              'SELECT id, character_id AS characterId, action, before_json AS beforeJson, after_json AS afterJson, currency_spent_count AS currencySpentCount, value_before AS valueBefore, value_after AS valueAfter, gain_loss AS gainLoss, created_at AS createdAt FROM crafting_history WHERE character_id=? ORDER BY created_at DESC LIMIT 100',
            )
            .all(characterId)
        : db
            .prepare(
              'SELECT id, character_id AS characterId, action, before_json AS beforeJson, after_json AS afterJson, currency_spent_count AS currencySpentCount, value_before AS valueBefore, value_after AS valueAfter, gain_loss AS gainLoss, created_at AS createdAt FROM crafting_history ORDER BY created_at DESC LIMIT 100',
            )
            .all()
    ) as Array<{
      id: number;
      characterId: number | null;
      action: string;
      beforeJson: string;
      afterJson: string;
      currencySpentCount: number;
      valueBefore: number | null;
      valueAfter: number | null;
      gainLoss: number | null;
      createdAt: string;
    }>;
    const history = rows.map((row) => {
      const after = JSON.parse(row.afterJson) as CraftingItemState;
      const nextActions = legalActions(after).filter((a) => a.legal);
      const safest = [...nextActions].sort((a, b) => riskRank(a.risk) - riskRank(b.risk))[0];
      return {
        id: row.id,
        characterId: row.characterId,
        action: row.action,
        currencySpentCount: row.currencySpentCount,
        valueBefore: row.valueBefore,
        valueAfter: row.valueAfter,
        gainLoss: row.gainLoss,
        createdAt: row.createdAt,
        nextSafeAction: safest ? safest.label : null,
        risks: nextActions
          .filter((a) => a.risk === 'high')
          .map((a) => `${a.label} carries high risk if attempted next.`),
      };
    });
    return res.json({ history });
  });
}
