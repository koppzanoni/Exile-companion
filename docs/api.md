# Backend API

All JSON request bodies use `Content-Type: application/json`.

## Build profile library

- `GET /api/build-profiles` returns Generic Build Fit, the 17 defaults, and SQLite custom profiles.
- `POST /api/build-profiles` creates a custom profile.
- `PUT /api/build-profiles/:id` updates a `custom:<id>` profile.
- `DELETE /api/build-profiles/:id` deletes a custom profile. Defaults are immutable.

Custom request fields are `name`, `mainSkill`, `className`, `ascendancy`, `weaponType`, `mainDamageType`, `defensiveLayer`, `importantStats`, `badStats`, and `notes`.

`POST /api/analyze` accepts `selectedBuildProfileId` or `selectedBuildProfileName`. When omitted, the response uses Generic Build Fit. The result is returned in `evaluation.buildFitAnalysis` and never substitutes for listing-based price evidence.

## `GET /api/health`

Returns service status and server timestamp.

## `POST /api/analyze`

Request:

```json
{
  "league": "Runes of Aldur",
  "itemText": "Rarity: Rare\n...",
  "equippedItemText": "Rarity: Rare\n...",
  "characterTotals": { "fireResistance": 75, "coldResistance": 75, "dexterity": 140 },
  "item": { "baseType": "Stone Greaves", "movementSpeed": 25 },
  "manualListings": "",
  "divineToExalted": 65,
  "save": true
}
```

`item` values override text-parsed values. If `manualListings` contains valid data, official fetch is skipped and the result source is `manual`. Otherwise the service tries live Trade2 and then a maximum-24-hour official cache. The response includes the normalized item, source, warning, official URL, estimate or `null`, ranked comparables, timestamp, saved check ID, and `recommendation`.

`recommendation` contains `action`, Low/Medium/High `confidence`, short and detailed reasons, optional `secondaryAction`, `doThisNext`, warnings, hidden-value flags, crafting score/label/reasons, improvement and pre-sale checks, best use case, and booleans for safe vendor, manual price check, and possible hidden value. It is serialized with saved checks.

Every response also includes top-level `craftingPotential`: score, six-level label, confidence, recommendation, reasons, risks, improvements, avoid actions, currency suggestions/warnings, Base Quality, and Roll Quality. The identical object is supplied to the Final Recommendation and serialized with saved checks.

When `equippedItemText` is present, the response also includes `comparison`: compatibility, verdict, confidence, quality/build-fit deltas, gains, losses, warnings, risks, normalized stat deltas, optional before/after character totals, better/worse dimensions, and recommendation impact. The comparison is stored with the saved check. `characterTotals` accepts Fire/Cold/Lightning/Chaos Resistance and Strength/Dexterity/Intelligence.

The request also accepts an optional `characterId`. When present and `league` is not explicitly overridden, the character's saved league/build are used, and a history entry is auto-recorded for that character (no separate "save to history" call).

Additional response fields, all derived from the same request/analysis (no parallel computation):

- `normalizedItem`: the same merged item used for pricing/build-fit/crafting, with classified prefixes/suffixes/implicits (tier, roll percentile, local/hybrid, confidence).
- `marketAnalysis`: strategy used, relaxation steps, found/discarded/used counts, and a `valuation` object with median/trimmed-mean/IQR/min-reliable/central/max-likely prices, confidence, liquidity (with basis text), outliers and price-fix suspects.
- `statValuation` / `equippedStatValuation`: per-stat contributions (value, local/global, build weight, slot weight, effective value before/after cap, offence/defence/utility category, wasted flag) plus offence/defence/utility/overall scores.
- `evaluations` / `decision`: four independent evaluation factors (`buildFit`, `upgradeValue`, `marketValue`, `craftPotential`, each with score/confidence/summary/positive+negative factors/limitations) and a 5-state `decision` (`Use`/`Sell`/`Craft`/`Keep`/`Discard`) with `conditionsToChange`.
- `opportunity`: better-alternative-same-price/for-more, cost of a relevant stat jump, wasted-expensive-stats, buy-vs-craft verdict (`unknown` when no verified crafting-cost model applies), and sell-to-upgrade feasibility.
- `beginnerSummary`: a one-sentence plain-language summary composed from the same `comparison`/`decision` data used everywhere else — never a separate judgment from the Advanced-mode detail.

## Market history

- `GET /api/market-history?baseType=<name>&league=<league>`: returns recorded `price_estimates` snapshots for that base type/league, a `trend` (`rising`/`falling`/`stable`/`unknown`, computed only once at least two snapshots exist), `priceFixFlaggedSnapshots`, and explicit `limitations` (a snapshot is active-listing evidence at capture time, not a confirmed sale). Snapshots are only ever recorded by `/api/analyze` when the search was a genuine `live` or `relaxed-live` result with at least one used comparable — manual, cached, or empty-sample results never seed history.

## Crafting state machine

- `POST /api/crafting/state`: parses an item and returns its `CraftingItemState`, the currently `legalActions` (each with `risk`, `outcomeCertainty`, `knownChance` only for genuinely deterministic mechanics, and `reversible:false`), and the known `currencies` catalog.
- `POST /api/crafting/apply`: given a state and a `currencyId`, returns the resulting state, the action's evaluation, and the new `legalActions` — purely a stateless preview, nothing is persisted.
- `POST /api/crafting/compare`: given a state and optional `sellValue`/`buyPrice`, returns a `continue`/`sell`/`buy-instead`/`unknown` recommendation with a reason.
- `POST /api/crafting/history`: persists a confirmed action (`before`/`after` state, `valueBefore`/`valueAfter`); `gainLoss` is computed only from caller-supplied values, never invented.
- `GET /api/crafting/history?characterId=<id>`: lists persisted actions with `gainLoss` and a live-computed `nextSafeAction`/`risks` derived by re-running `legalActions()` against the stored `after` state.

## Characters

- `GET/POST /api/characters`, `GET/PUT/DELETE /api/characters/:id`, `PUT /api/characters/:id/equipment`.
- `GET /api/characters/:id` computes `diagnosis` live (via the same Build Doctor engine) from stored equipment — totals are never duplicated in storage.

## Build Doctor

- `POST /api/build-doctor`: given pasted `equipment` slots and an optional build profile, returns resistance/attribute/Spirit/defence totals, per-slot scores, a weakest-slots list, a recommended upgrade order with a High/Medium/Low `budgetPriority` (never an invented currency figure — no verified crafting-cost model exists), and dependency alerts (e.g. "don't swap this slot before recovering N Dexterity").

## Leveling

- `POST /api/leveling/search`: given a guide URL, level, league, max price and optional pasted `equipment`, returns milestone-aware, budget-split listings limited to the 2–3 highest-priority slots (or the weakest slots, if equipment was pasted), each with a `buy-now`/`wait`/`not-worth-it` verdict.

## Admin: patch updater (modifier catalog)

- `GET /api/admin/patch/versions`: lists all staged/active/deprecated/rolled-back catalog versions with their regression result and diff vs. the version that was active when they were staged.
- `POST /api/admin/patch/stage`: validates (Zod schema + regex-compilability + duplicate-id checks) and normalizes a candidate modifier catalog — either inline `modifiers` or downloaded from an HTTPS `source` URL — then stores it as an inactive, regression-tested version. The active catalog is untouched until explicitly activated.
- `POST /api/admin/patch/:id/activate`: activates a staged version only if its regression check passed (422 otherwise); a failing patch can never replace the active version automatically. Deprecates the previously active version instead of deleting it.
- `POST /api/admin/patch/:id/rollback`: reactivates a previously-deprecated version, preserving full history.

## `POST /api/trade/parse-url`

Body: `{ "url": "https://www.pathofexile.com/trade2/search/poe2/..." }`.

Validates the official host, extracts the league and path query ID, and decodes a `q` value as raw JSON, URL-encoded JSON, or base64url JSON. Returns type, rarity, filters, stat groups, sort, raw query, and a database ID. A parsed query is saved to `trade_queries`.

## `POST /api/trade/build-url`

Accepts `league`, `itemText`, and `item` fields like `/api/analyze`. Returns a shareable official Trade2 URL with a base64url `q` containing the generated query.

## Saved checks

- `GET /api/checks`: newest-first check summaries.
- `GET /api/checks/:id`: full saved check and comparable listings.
- `DELETE /api/checks/:id`: deletes a check and its comparables; returns `204`.

Unknown IDs return `404`.

## Settings

- `GET /api/settings`: returns currency/league plus `craftingRiskTolerance`, `showCurrencyWarnings`, and `conservativeCraftingRecommendations`.
- `PUT /api/settings`: validates all settings. The rate must be positive and risk tolerance is Low, Medium, or High. Each rate update also appends to `currency_rates` with source `manual`.

## Active build profile

- `GET /api/build-profile`: returns `{ "profile": null }` or the saved active profile.
- `POST /api/build-profile/import`: validates a build guide URL (Mobalytics, poe.ninja, Maxroll, PoE Vault or pobb.in) and returns a reviewable profile draft, a structured `fields` array (per field: detected value, source excerpt, method, confidence, `needsConfirmation`), a `partial` flag when a core field could not be reliably detected, the extracted Equipment Priority text, source/method, warnings, and a `snapshotId` for the persisted import snapshot. It does not save automatically, and an incomplete fetch is never reported as a clean success.
- `PUT /api/build-profile`: validates and replaces the active profile. It accepts build identity, progression stage, defence style, weighted stat priorities, required/desired modifier phrases, and notes.
- `DELETE /api/build-profile`: removes the active profile and returns `204`.

When a profile exists, `/api/analyze` includes `evaluation.personalized` with its independent score, fit label, verdict, matches, missing priorities, and conflicts.

Mobalytics may block direct server requests with Cloudflare. In that case import uses the read-only Jina AI Reader endpoint and labels the source in the response so the user can review it before saving.

Validation errors return `400` with `{ "error": "..." }`; unexpected errors return `500`.
