import type { Express, RequestHandler } from 'express';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { AppDatabase } from './db.js';
import { startOAuth } from './poeOAuth.js';

const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(200),
  displayName: z.string().trim().min(1).max(80).optional(),
});
const sessionHours = Math.max(1, Number(process.env.SESSION_HOURS || 168));
const secure = process.env.NODE_ENV === 'production';
const cookieName = 'exile_session';

function cookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((value) => value.trim().split('=').map(decodeURIComponent))
      .filter((parts) => parts.length === 2) as Array<[string, string]>,
  );
}
function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password: string, stored: string) {
  const [salt, digest] = stored.split(':');
  if (!salt || !digest) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function verifyAccountPassword(db: AppDatabase, userId: number, password: string) {
  const row = db.prepare('SELECT password_hash AS passwordHash FROM app_users WHERE id=?').get(userId) as
    { passwordHash: string | null } | undefined;
  return Boolean(row?.passwordHash && verifyPassword(password, row.passwordHash));
}
function setSessionCookie(res: any, id: string, maxAgeSeconds: number) {
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`,
  );
}
function createSession(db: AppDatabase, userId: number) {
  const id = randomUUID(),
    csrf = randomBytes(24).toString('base64url');
  db.prepare('DELETE FROM app_sessions WHERE expires_at<=CURRENT_TIMESTAMP').run();
  db.prepare("INSERT INTO app_sessions(id,user_id,csrf_token,expires_at) VALUES (?,?,?,datetime('now',?))").run(
    id,
    userId,
    csrf,
    `+${sessionHours} hours`,
  );
  return { id, csrf, maxAge: sessionHours * 3600 };
}
export function establishSession(db: AppDatabase, res: any, userId: number) {
  const session = createSession(db, userId);
  setSessionCookie(res, session.id, session.maxAge);
  return session;
}
function configuredAdmin(email: string) {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export function installAuth(app: Express, db: AppDatabase) {
  const attempts = new Map<string, { at: number; count: number }>();
  const limit: RequestHandler = (req, res, next) => {
    const key = req.ip || 'unknown',
      now = Date.now(),
      current = attempts.get(key);
    if (!current || now - current.at > 60_000) {
      attempts.set(key, { at: now, count: 1 });
      return next();
    }
    current.count++;
    if (current.count > 10)
      return res.status(429).json({ error: 'Too many authentication attempts. Try again shortly.' });
    next();
  };
  app.post('/api/auth/register', limit, (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Use a valid email, name and password with at least 10 characters.' });
    try {
      const isAdmin = configuredAdmin(parsed.data.email),
        result = db
          .prepare('INSERT INTO app_users(email,password_hash,display_name,is_admin) VALUES (?,?,?,?)')
          .run(
            parsed.data.email,
            hashPassword(parsed.data.password),
            parsed.data.displayName || parsed.data.email.split('@')[0],
            isAdmin ? 1 : 0,
          );
      const session = createSession(db, Number(result.lastInsertRowid));
      setSessionCookie(res, session.id, session.maxAge);
      return res.status(201).json({
        user: {
          id: Number(result.lastInsertRowid),
          email: parsed.data.email,
          displayName: parsed.data.displayName || parsed.data.email.split('@')[0],
          isAdmin,
        },
        csrfToken: session.csrf,
      });
    } catch {
      return res.status(409).json({ error: 'This email is already registered.' });
    }
  });
  app.post('/api/auth/login', limit, (req, res) => {
    const parsed = credentials.omit({ displayName: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password.' });
    const user = db
      .prepare(
        'SELECT id,email,password_hash AS passwordHash,display_name AS displayName,is_admin AS isAdmin FROM app_users WHERE email=?',
      )
      .get(parsed.data.email) as any;
    if (!user?.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash))
      return res.status(401).json({ error: 'Invalid email or password.' });
    if (configuredAdmin(user.email) && !user.isAdmin) {
      db.prepare('UPDATE app_users SET is_admin=1 WHERE id=?').run(user.id);
      user.isAdmin = 1;
    }
    const session = createSession(db, user.id);
    setSessionCookie(res, session.id, session.maxAge);
    return res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName, isAdmin: Boolean(user.isAdmin) },
      csrfToken: session.csrf,
    });
  });
  app.get('/api/auth/poe/start', limit, (_req, res) => {
    try {
      return res.json({ url: startOAuth(db) });
    } catch (error) {
      return res
        .status(503)
        .json({ error: error instanceof Error ? error.message : 'Path of Exile login is unavailable.' });
    }
  });
  app.post('/api/auth/logout', (req, res) => {
    const id = cookies(req.header('cookie'))[cookieName];
    if (id) db.prepare('DELETE FROM app_sessions WHERE id=?').run(id);
    setSessionCookie(res, '', 0);
    return res.status(204).send();
  });
  const middleware: RequestHandler = (req, res, next) => {
    const id = cookies(req.header('cookie'))[cookieName];
    const session = id
      ? (db
          .prepare(
            'SELECT s.user_id AS userId,s.csrf_token AS csrfToken,u.email,u.display_name AS displayName FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>CURRENT_TIMESTAMP',
          )
          .get(id) as any)
      : null;
    if (session) {
      res.locals.user = session;
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        req.path != '/auth/logout' &&
        req.header('x-csrf-token') !== session.csrfToken
      )
        return res.status(403).json({ error: 'Invalid session CSRF token.' });
      return next();
    }
    if (
      process.env.AUTH_REQUIRED === 'true' &&
      !req.path.startsWith('/auth/') &&
      !req.path.startsWith('/health') &&
      req.path != '/poe/oauth/callback' &&
      req.path != '/worker/tick'
    )
      return res.status(401).json({ error: 'Sign in required.' });
    return next();
  };
  app.get('/api/auth/me', (req, res) => {
    const id = cookies(req.header('cookie'))[cookieName];
    const session = id
      ? (db
          .prepare(
            'SELECT s.user_id AS id,s.csrf_token AS csrfToken,u.email,u.display_name AS displayName FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>CURRENT_TIMESTAMP',
          )
          .get(id) as any)
      : null;
    return res.json(
      session
        ? {
            authenticated: true,
            user: { id: session.id, email: session.email, displayName: session.displayName },
            csrfToken: session.csrfToken,
          }
        : { authenticated: false, required: process.env.AUTH_REQUIRED === 'true' },
    );
  });
  app.use('/api', middleware);
  app.get('/api/auth/sessions', (req, res) => {
    const userId = res.locals.user?.userId,
      current = cookies(req.header('cookie'))[cookieName];
    if (!userId) return res.status(401).json({ error: 'Sign in required.' });
    const sessions = db
      .prepare(
        'SELECT id,created_at AS createdAt,expires_at AS expiresAt FROM app_sessions WHERE user_id=? AND expires_at>CURRENT_TIMESTAMP ORDER BY created_at DESC',
      )
      .all(userId) as Array<{ id: string; createdAt: string; expiresAt: string }>;
    return res.json({ sessions: sessions.map((session) => ({ ...session, current: session.id === current })) });
  });
  app.delete('/api/auth/sessions/:id', (req, res) => {
    const userId = res.locals.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Sign in required.' });
    const result = db.prepare('DELETE FROM app_sessions WHERE id=? AND user_id=?').run(req.params.id, userId);
    return result.changes ? res.status(204).send() : res.status(404).json({ error: 'Session not found.' });
  });
  app.post('/api/auth/password/change', (req, res) => {
    const userId = res.locals.user?.userId,
      parsed = z
        .object({ currentPassword: z.string().min(10).max(200), newPassword: z.string().min(12).max(200) })
        .safeParse(req.body);
    if (!userId || !parsed.success || !verifyAccountPassword(db, userId, parsed.data.currentPassword))
      return res.status(403).json({ error: 'Current password is invalid or the new password is too short.' });
    db.prepare('UPDATE app_users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(
      hashPassword(parsed.data.newPassword),
      userId,
    );
    const current = cookies(req.header('cookie'))[cookieName];
    db.prepare('DELETE FROM app_sessions WHERE user_id=? AND id<>?').run(userId, current);
    return res.json({ ok: true, otherSessionsRevoked: true });
  });
}
