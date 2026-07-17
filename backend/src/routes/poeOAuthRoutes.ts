import type { Express } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db.js';
import { establishSession } from '../auth.js';
import {
  completeOAuth,
  fetchPoe2Character,
  fetchPoe2Characters,
  markSync,
  oauthFrontendUrl,
  oauthStatus,
  startOAuth,
} from '../poeOAuth.js';
import { equipmentFromPoeCharacter, getCharacterRow, importPoeCharacter, message } from '../appHelpers.js';

export function installPoeOAuthRoutes(app: Express, db: AppDatabase): void {
  app.delete('/api/poe/oauth/connections/:id', (req, res) => {
    const userId = res.locals.user?.userId;
    const result = userId
      ? db.prepare('DELETE FROM poe_oauth_connections WHERE id=? AND user_id=?').run(req.params.id, userId)
      : db.prepare('DELETE FROM poe_oauth_connections WHERE id=?').run(req.params.id);
    return result.changes ? res.status(204).send() : res.status(404).json({ error: 'Connection not found.' });
  });
  app.get('/api/poe/oauth/status', (_req, res) => res.json(oauthStatus(db, res.locals.user?.userId)));
  app.get('/api/poe/oauth/start', (_req, res) => {
    try {
      return res.json({ url: startOAuth(db, res.locals.user?.userId) });
    } catch (error) {
      return res.status(503).json({ error: message(error) });
    }
  });
  app.get('/api/poe/oauth/callback', async (req, res) => {
    try {
      const code = String(req.query.code || '');
      const state = String(req.query.state || '');
      if (!code || !state)
        throw new Error(
          String(req.query.error_description || req.query.error || 'Path of Exile did not authorize the connection.'),
        );
      const completed = await completeOAuth(db, code, state);
      if (completed.isLogin) establishSession(db, res, completed.userId);
      return res.redirect(302, oauthFrontendUrl(`/characters?poe=connected&connection=${completed.connection.id}`));
    } catch (error) {
      try {
        return res.redirect(
          302,
          oauthFrontendUrl(`/characters?poe=error&message=${encodeURIComponent(message(error))}`),
        );
      } catch {
        return res.status(400).json({ error: message(error) });
      }
    }
  });
  app.get('/api/poe/characters/:connectionId', async (req, res) => {
    try {
      return res.json({
        characters: await fetchPoe2Characters(db, Number(req.params.connectionId), res.locals.user?.userId),
      });
    } catch (error) {
      markSync(db, Number(req.params.connectionId), message(error));
      return res.status(502).json({ error: message(error) });
    }
  });
  app.post('/api/poe/characters/:connectionId/import', async (req, res) => {
    const parsed = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Choose a valid Path of Exile character.' });
    try {
      const userId = res.locals.user?.userId,
        remote = await fetchPoe2Character(db, Number(req.params.connectionId), parsed.data.name, userId),
        localId = importPoeCharacter(db, remote, userId);
      markSync(db, Number(req.params.connectionId));
      return res.json({
        character: getCharacterRow(db, localId),
        importedEquipment: equipmentFromPoeCharacter(remote).length,
      });
    } catch (error) {
      markSync(db, Number(req.params.connectionId), message(error));
      return res.status(502).json({ error: message(error) });
    }
  });
}
