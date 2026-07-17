import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { AppDatabase } from './db.js';

const AUTHORIZE_URL = 'https://www.pathofexile.com/oauth/authorize',
  TOKEN_URL = 'https://www.pathofexile.com/oauth/token',
  API_URL = 'https://api.pathofexile.com',
  SCOPE = 'account:profile account:characters';
export interface PoeOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenKey: string;
  userAgent: string;
  frontendUrl: string;
}
export interface PoeConnection {
  id: number;
  username: string | null;
  scope: string;
  lastSyncAt: string | null;
  lastError: string | null;
}
export interface PoeCharacter {
  name: string;
  league?: string;
  level?: number;
  class?: string;
  className?: string;
  ascendancy?: string;
  items?: unknown[];
  inventory?: unknown[];
  equipment?: unknown[];
}

export function oauthConfig(): PoeOAuthConfig | null {
  const clientId = process.env.POE_OAUTH_CLIENT_ID || '',
    clientSecret = process.env.POE_OAUTH_CLIENT_SECRET || '',
    redirectUri = process.env.POE_OAUTH_REDIRECT_URI || '',
    tokenKey = process.env.POE_OAUTH_TOKEN_ENCRYPTION_KEY || '';
  if (!clientId || !clientSecret || !redirectUri || !tokenKey) return null;
  return {
    clientId,
    clientSecret,
    redirectUri,
    tokenKey,
    userAgent:
      process.env.POE_OAUTH_USER_AGENT ||
      `OAuth ${clientId}/1.0 (contact: ${process.env.POE_OAUTH_CONTACT || 'admin@example.invalid'})`,
    frontendUrl: process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173',
  };
}
export function oauthStatus(db: AppDatabase, userId?: number) {
  const config = oauthConfig();
  const connections = (userId
    ? db
        .prepare(
          'SELECT id,poe_username AS username,scope,last_sync_at AS lastSyncAt,last_error AS lastError FROM poe_oauth_connections WHERE user_id=? ORDER BY updated_at DESC',
        )
        .all(userId)
    : db
        .prepare(
          'SELECT id,poe_username AS username,scope,last_sync_at AS lastSyncAt,last_error AS lastError FROM poe_oauth_connections ORDER BY updated_at DESC',
        )
        .all()) as unknown as PoeConnection[];
  return {
    configured: Boolean(config),
    required: [
      'POE_OAUTH_CLIENT_ID',
      'POE_OAUTH_CLIENT_SECRET',
      'POE_OAUTH_REDIRECT_URI',
      'POE_OAUTH_TOKEN_ENCRYPTION_KEY',
    ],
    connections,
  };
}
export function startOAuth(db: AppDatabase, userId?: number) {
  const config = requiredConfig(),
    state = base64url(randomBytes(32)),
    verifier = base64url(randomBytes(48)),
    challenge = base64url(createHash('sha256').update(verifier).digest());
  db.prepare("DELETE FROM poe_oauth_states WHERE created_at < datetime('now','-10 minutes')").run();
  db.prepare('INSERT INTO poe_oauth_states(state,verifier,user_id) VALUES (?,?,?)').run(
    state,
    verifier,
    userId ?? null,
  );
  const url = new URL(AUTHORIZE_URL);
  for (const [key, value] of Object.entries({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }))
    url.searchParams.set(key, value);
  return url.toString();
}
export async function completeOAuth(db: AppDatabase, code: string, state: string) {
  const config = requiredConfig();
  const row = db.prepare('SELECT verifier,user_id AS userId FROM poe_oauth_states WHERE state=?').get(state) as
    { verifier: string; userId: number | null } | undefined;
  db.prepare('DELETE FROM poe_oauth_states WHERE state=?').run(state);
  if (!row) throw new Error('OAuth session expired or did not match. Start the connection again.');
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    scope: SCOPE,
    code_verifier: row.verifier,
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': config.userAgent },
    body,
  });
  const token = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof token.access_token !== 'string')
    throw new Error(
      `Path of Exile token exchange failed: ${String(token.error_description || token.error || response.status)}`,
    );
  const subject = String(token.sub || ''),
    username = typeof token.username === 'string' ? token.username : 'Path of Exile Player';
  if (!subject) throw new Error('Path of Exile did not return an account identity.');
  const externalSubject = `poe:${subject}`,
    existingConnection = db
      .prepare('SELECT user_id AS userId FROM poe_oauth_connections WHERE poe_subject=?')
      .get(subject) as { userId: number | null } | undefined;
  let userId = row.userId ?? existingConnection?.userId ?? null;
  const isLogin = row.userId === null;
  if (!userId) {
    const existingUser = db.prepare('SELECT id FROM app_users WHERE external_subject=?').get(externalSubject) as
      { id: number } | undefined;
    if (existingUser) userId = existingUser.id;
    else
      userId = Number(
        db
          .prepare('INSERT INTO app_users(external_subject,display_name,is_admin) VALUES (?,?,0)')
          .run(externalSubject, username).lastInsertRowid,
      );
  } else {
    const owner = db
      .prepare('SELECT id FROM app_users WHERE external_subject=? AND id<>?')
      .get(externalSubject, userId);
    if (owner) throw new Error('This Path of Exile account is already linked to another workspace.');
    db.prepare(
      'UPDATE app_users SET external_subject=COALESCE(external_subject,?),updated_at=CURRENT_TIMESTAMP WHERE id=?',
    ).run(externalSubject, userId);
  }
  const cipher = (value: string) => encrypt(value, config.tokenKey),
    expiry = typeof token.expires_in === 'number' ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
  db.prepare(
    `INSERT INTO poe_oauth_connections(poe_subject,poe_username,scope,access_token_ciphertext,refresh_token_ciphertext,access_expires_at,user_id) VALUES (?,?,?,?,?,?,?) ON CONFLICT(poe_subject) DO UPDATE SET poe_username=excluded.poe_username,scope=excluded.scope,access_token_ciphertext=excluded.access_token_ciphertext,refresh_token_ciphertext=excluded.refresh_token_ciphertext,access_expires_at=excluded.access_expires_at,user_id=excluded.user_id,updated_at=CURRENT_TIMESTAMP,last_error=NULL`,
  ).run(
    subject,
    username,
    String(token.scope || SCOPE),
    cipher(token.access_token),
    typeof token.refresh_token === 'string' ? cipher(token.refresh_token) : null,
    expiry,
    userId,
  );
  const connection = db
    .prepare(
      'SELECT id,poe_username AS username,scope,last_sync_at AS lastSyncAt,last_error AS lastError FROM poe_oauth_connections WHERE poe_subject=?',
    )
    .get(subject) as unknown as PoeConnection;
  return { connection, userId, isLogin };
}
export async function fetchPoe2Characters(db: AppDatabase, connectionId: number, userId?: number) {
  const accessToken = connectionToken(db, connectionId, userId);
  const config = requiredConfig(),
    response = await fetch(`${API_URL}/character/poe2`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': config.userAgent, Accept: 'application/json' },
    }),
    payload = (await response.json()) as { characters?: PoeCharacter[]; error?: unknown };
  if (!response.ok)
    throw new Error(`Path of Exile character request failed: ${String(payload.error || response.status)}`);
  return payload.characters || [];
}
export async function fetchPoe2Character(db: AppDatabase, connectionId: number, name: string, userId?: number) {
  const accessToken = connectionToken(db, connectionId, userId);
  const config = requiredConfig(),
    response = await fetch(`${API_URL}/character/poe2/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': config.userAgent, Accept: 'application/json' },
    }),
    payload = (await response.json()) as { character?: PoeCharacter; error?: unknown };
  if (!response.ok || !payload.character)
    throw new Error(`Path of Exile character import failed: ${String(payload.error || response.status)}`);
  return payload.character;
}
export function markSync(db: AppDatabase, id: number, error?: string) {
  db.prepare(
    'UPDATE poe_oauth_connections SET last_sync_at=CURRENT_TIMESTAMP,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
  ).run(error || null, id);
}
export function oauthFrontendUrl(path: string) {
  return `${requiredConfig().frontendUrl.replace(/\/$/, '')}${path}`;
}
function connectionToken(db: AppDatabase, id: number, userId?: number) {
  const row = (
    userId
      ? db.prepare('SELECT access_token_ciphertext FROM poe_oauth_connections WHERE id=? AND user_id=?').get(id, userId)
      : db.prepare('SELECT access_token_ciphertext FROM poe_oauth_connections WHERE id=?').get(id)
  ) as { access_token_ciphertext: string } | undefined;
  if (!row) throw new Error('Connected Path of Exile account was not found.');
  return decrypt(row.access_token_ciphertext, requiredConfig().tokenKey);
}
function requiredConfig() {
  const config = oauthConfig();
  if (!config)
    throw new Error('Path of Exile OAuth is not configured. Add the required server environment variables first.');
  return config;
}
function base64url(value: Buffer) {
  return value.toString('base64url');
}
function key(value: string) {
  return createHash('sha256').update(value).digest();
}
function encrypt(value: string, secret: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(secret), iv),
    data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${data.toString('base64url')}`;
}
function decrypt(value: string, secret: string) {
  const [ivText, tagText, dataText] = value.split('.');
  if (!ivText || !tagText || !dataText) throw new Error('Stored OAuth token is malformed. Reconnect the account.');
  const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8');
}
