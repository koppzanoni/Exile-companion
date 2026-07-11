# Project structure

```text
poe2-orb-analyzer/
├── backend/
│   ├── src/
│   │   ├── app.ts          Express API and persistence workflow
│   │   ├── db.ts           SQLite schema and settings helpers
│   │   ├── itemParser.ts   PoE 2 clipboard-text parser
│   │   ├── pricing.ts      Similarity, outliers and price tiers
│   │   ├── trade.ts        Trade2 URL/query and live fetch service
│   │   └── *.test.ts       Backend behavioral tests
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/          Analyzer, saved checks, settings and docs
│   │   ├── components/     Result and currency displays
│   │   ├── api.ts          Typed API client
│   │   └── styles.css      Responsive dark-fantasy design system
│   ├── nginx.conf          SPA fallback and /api reverse proxy
│   └── Dockerfile
├── docs/
├── docker-compose.yml
└── README.md
```

The browser talks only to `/api`. In Docker, nginx proxies those requests to the backend service. Express owns all official-site access, avoiding browser CORS restrictions where possible. SQLite uses WAL mode and a persistent Compose volume.

## Database tables

- `checks`: input item, final result, source label, warning and timestamp.
- `comparable_listings`: normalized evidence and similarity per saved check.
- `settings`: current user-editable defaults.
- `trade_queries`: every successfully parsed official URL.
- `currency_rates`: timestamped manual/default Divine-to-Exalted rates.

Deleting a check cascades to its comparable listings. Live official listings from matching-base checks may be reused for up to 24 hours when live access fails; the resulting analysis is explicitly marked `cache`.
