# Relic Lens — PoE 2 Orb Analyzer

Relic Lens is a full-stack Path of Exile 2 price-comparison app. Paste an item or enter its stats, choose a league, and compare it with listings requested from the official PoE 2 Trade service. Every result is labeled **live**, **cached**, **manual**, or **no market data**; the app never substitutes invented listings when official access fails.

Every item also receives a market-independent quality evaluation: a 0–100 grade, strengths and weaknesses, upgrade priorities, market breadth, and build-archetype matches. On **My Build**, paste a Mobalytics PoE 2 guide URL to import its identity and Equipment Priority guidance into a reviewable profile, or configure one manually. The active profile adds a second, personalized score based on class, skill, progression stage, defence, stat priorities, minimum rolls, and slot-scoped required modifiers. This remains available even when Trade2 has no listings.

## Category Analysis

Everything remains on the Analyzer page. Pasted Item Class and base type distinguish Body Armour, Helmet, Gloves, Boots, Shield, Focus, Quiver, Bow, Crossbow, one-/two-handed melee weapons, Staff, Quarterstaff, Wand, Sceptre, Ring, Amulet, and Belt.

The Category Analysis card shows why the category was detected, its dedicated score, positive and wasted stats, missing core stats, build/market signals, Trade2 priorities, confidence, warnings, and an expandable parser-debug table mapping original item lines to normalized stats. Weapon scoring is offensive; Shield, Boots, Quiver, armour, and accessory logic use their own slot rules.

For the most precise result, enable Advanced Item Descriptions in PoE 2 before copying. Roll ranges and affix tiers are preserved and evaluated, while item level is treated as crafting potential rather than free quality points.

## Build Fit Analysis

Choose a profile directly on the Analyzer page. The result shows a 0–100 build-specific score, Bad-to-Build-defining label, fit/conflict reasons, missing and wasted stats, best use case, confidence, and a recommended action. Generic Build Fit is used when no specific build is selected.

The app ships with 17 profiles covering Deadeye, Mercenary, Monk, Minion, caster, Warrior, Ranger, and generic archetypes. Create persistent custom profiles under **My Build → Custom Build Fit Profiles**; they are stored in SQLite and immediately appear in the selector. See [docs/build-fit.md](docs/build-fit.md).

## Final Recommendation

Every analysis begins with one explicit action: **Use, Sell, Craft, Replace Soon, Price Check, Vendor, or Keep for Later**. The decision combines category quality, selected-build fit, Trade2 verification, estimate confidence, rarity, item level, corruption, roll information, missing/wasted stats, hidden-value signals, and crafting potential. It includes confidence, reasons, a secondary option, next steps, warnings, and a crafting-potential score.

Vendor is deliberately conservative, and Sell requires live official market evidence. Uniques and build-enabling modifiers are protected by Price Check/Keep logic. See [docs/recommendations.md](docs/recommendations.md).

## Equipped Item Comparison

Enable **Compare with Equipped Item** on the Analyzer, paste the current item, and optionally enter character resistance/attribute totals. The result shows Clear/Small/Offensive/Defensive/Situational Upgrade, Sidegrade, Downgrade, Not Comparable, or Needs Manual Review, plus quality and Build Fit changes, gains/losses, cap or requirement risks, and recommendation impact. Category-specific rules prevent comparisons such as Ring vs Amulet or Bow vs Shield. See [docs/equipped-comparison.md](docs/equipped-comparison.md).

## Crafting Potential

The Analyzer includes a dedicated Crafting Potential card with score, six-level label, confidence, Base Quality, Roll Quality, risks, improvements, avoid actions, and explicit Divine/Exalted/Regal/augmentation/quality guidance. Corrupted items, low-DPS weapons, no-speed Boots, bad bases, and modifier packages with too many problems are protected from optimistic currency recommendations. Risk tolerance and warning behavior are configurable under Settings. See [docs/crafting-potential.md](docs/crafting-potential.md).

## Run with Docker

Requirements: Docker Desktop with Docker Compose v2.

```bash
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). The API is also exposed at [http://localhost:3001/api/health](http://localhost:3001/api/health). SQLite data persists in the `poe2_data` Docker volume.

Stop the app with `Ctrl+C`, then:

```bash
docker compose down
```

Use `docker compose down -v` only when you intentionally want to erase saved checks, cached listings, settings, query history, and rate history.

## Tests in Docker

```bash
docker compose run --rm --build backend-test
docker compose run --rm --build frontend-test
```

These execute behavioral Vitest suites for parsing, URL handling, pricing, persistence, currency conversion, forms, and result rendering—not type-check-only checks.

## Local development

Node.js 22 is recommended.

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173` · Backend: `http://localhost:3001`.

```bash
npm test
npm run build
```

The default local database is `data/poe2-analyzer.db`. Set `DATABASE_PATH` to override it.

## Honest market-data behavior

The backend sends the generated query to the official `pathofexile.com/api/trade2` search and fetch endpoints. Rate limiting, Cloudflare, API changes, or session requirements can prevent that request. If so, Relic Lens displays the actual failure, offers its generated official search URL, and accepts manually exported listings as JSON or simple lines:

```text
25 exalted | Stone Greaves | +70 Life, 25% Movement Speed
1 divine | Stone Greaves | +80 Life, 30% Movement Speed
```

JSON provides richer comparisons:

```json
[
  {
    "price": 25,
    "currency": "exalted",
    "baseType": "Stone Greaves",
    "rarity": "rare",
    "stats": { "life": 70, "movementSpeed": 25, "armour": 260 }
  }
]
```

After an analysis, **Export JSON** downloads the normalized comparable table so it can be archived or pasted back into another manual check.

The Divine-to-Exalted conversion is deliberately manual and stored in SQLite. See [docs/structure.md](docs/structure.md), [docs/api.md](docs/api.md), [docs/pricing-logic.md](docs/pricing-logic.md), [docs/recommendations.md](docs/recommendations.md), [docs/equipped-comparison.md](docs/equipped-comparison.md), [docs/crafting-potential.md](docs/crafting-potential.md), [docs/racer-research.md](docs/racer-research.md), [docs/trade2.md](docs/trade2.md), and [docs/docker.md](docs/docker.md).

This is an unofficial community tool and is not affiliated with Grinding Gear Games.
