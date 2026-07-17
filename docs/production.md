# Production operation

Copy `.env.example` to `.env`, replace every placeholder with an independent random secret, and configure the public frontend origin. `GEMINI_API_KEY` remains backend-only and must never be exposed as a `VITE_` variable.

Run the full stack with `docker compose up -d --build`. The stack contains frontend, API, market-monitor worker and backup worker. Backups are verified immediately and rotated according to `BACKUP_RETENTION_COUNT`; database and backups use independent named volumes.

Set `AUTH_REQUIRED=true` for a shared or public deployment. Sessions use an `HttpOnly`, `SameSite=Lax` cookie and every state-changing authenticated request requires its per-session CSRF token. Keep `APP_ACCESS_TOKEN` empty for a normal browser-facing deployment; it is an operator-level gate, not a substitute for user authentication.

Before an upgrade, create and verify a backup. Restore only during a maintenance window with the API and workers stopped, then run the `verify` command before reopening traffic.

The operational probes are `/api/health`, `/api/health/detailed` and `/api/metrics`. Restrict the detailed and metrics endpoints at the reverse proxy in an internet-facing deployment.

## Character data catalogs

Passive-tree, ascendancy and quest catalogs are installed as immutable, source-attributed manifests through the administrator endpoint. A manifest must provide `kind`, `patch`, `version`, an HTTPS `source`, ISO `updatedAt`, `confidence` and its validated payload. The character UI resolves only an exact tree-version/patch match; a nearby or newer catalog is never silently substituted. Keep catalog ingestion in CI or an authenticated operator workflow and retain the upstream artifact checksum outside the application database.

## Reverse proxy and observability

Set `TRUST_PROXY_HOPS` only when the API is behind a known proxy and use its exact hop count. Leaving it blank prevents spoofed forwarding headers from influencing rate limiting. The API emits defensive response headers and the frontend proxy adds browser-facing headers. Apply TLS and a deployment-specific Content Security Policy at the edge after all required image/API origins are known.

Metrics and detailed health expose operational counts, not secrets, but should still be limited to the monitoring network. Alert on database-integrity failure, sustained 5xx responses, overdue worker locks, repeated backup failures and Gemini budget/rate-limit events. SQLite backups must be restored in a rehearsed maintenance procedure before the service is considered production-ready.
# Path of Exile sign-in

The login screen can use the same OAuth 2.1 authorization-code + PKCE flow as character import. Register the exact callback URI ending in `/api/poe/oauth/callback`, request `account:profile account:characters`, and keep the client secret and token-encryption key on the backend only. Confidential clients require an HTTPS callback on a registered domain; GGG does not accept localhost for that client type. Steam users authenticate through the Path of Exile account to which Steam is linked.
