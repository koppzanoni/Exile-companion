# Docker operation

## Start

From the repository root:

```bash
docker compose up --build
```

- UI: `http://localhost:8080`
- API health: `http://localhost:3001/api/health`
- SQLite volume: `poe2_data` mounted at `/app/data`

The frontend image builds the Vite app and serves it with nginx. nginx proxies `/api` to the Express container. The backend uses Node's built-in SQLite driver, so no platform-specific database addon is required.

## Stop and clean up

```bash
docker compose down
```

This preserves data. To intentionally remove the database volume:

```bash
docker compose down -v
```

## Run tests inside containers

```bash
docker compose run --rm --build backend-test
docker compose run --rm --build frontend-test
```

Test targets contain source and development dependencies. Production images are smaller and exclude them.

## Environment

The Compose backend sets:

- `PORT=3001`
- `DATABASE_PATH=/app/data/poe2-analyzer.db`
- `FRONTEND_ORIGIN=http://localhost:8080`

Change host port mappings if 8080 or 3001 is occupied. Do not change nginx’s internal `backend:3001` target unless you also rename the Compose service or backend port.

## Troubleshooting

- **UI starts but API calls fail:** inspect `docker compose logs backend` and verify `/api/health`.
- **Database cannot open:** verify the Compose volume is writable, then inspect `docker compose logs backend`.
- **Trade2 warning:** this usually indicates official rate limiting, Cloudflare, or access policy—not a Docker fault. Open the provided official URL and paste listing data manually.
- **Reset only application data:** stop Compose, remove the `poe2_data` volume, and start again. This is irreversible.
