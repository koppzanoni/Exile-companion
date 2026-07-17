import type { Express } from 'express';
import type { AppDatabase } from '../db.js';
import { buildTradeUrl, parseTradeUrl } from '../trade.js';
import { mergeItem, parseItemText } from '../itemParser.js';
import type { ItemStats } from '../types.js';
import { message } from '../appHelpers.js';

export function installTradeRoutes(app: Express, db: AppDatabase): void {
  app.post('/api/trade/parse-url', (req, res) => {
    try {
      const parsed = parseTradeUrl(String(req.body?.url || ''));
      const result = db
        .prepare('INSERT INTO trade_queries(source_url, league, parsed_json) VALUES (?, ?, ?)')
        .run(req.body.url, parsed.league, JSON.stringify(parsed));
      res.json({ id: Number(result.lastInsertRowid), ...parsed });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });

  app.post('/api/trade/build-url', (req, res) => {
    try {
      const parsed = parseItemText(String(req.body?.itemText || ''));
      const item = mergeItem(parsed, (req.body?.item || {}) as Partial<ItemStats>);
      const league = String(req.body?.league || 'Runes of Aldur');
      res.json({ url: buildTradeUrl(item, league), item });
    } catch (error) {
      res.status(400).json({ error: message(error) });
    }
  });
}
