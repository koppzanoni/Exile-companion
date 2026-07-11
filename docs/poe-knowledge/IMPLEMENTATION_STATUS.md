# Implementation status

This is the delivery checklist for `PRODUCT_VISION.pt-BR.md` and must change with the code.

## Delivered

- Preserved React/Vite, Express/TypeScript and SQLite architecture.
- Normalized item/modifier contracts, advanced clipboard parsing and 12 real-item fixtures.
- Selectable/custom builds and imports from Mobalytics, poe.ninja, Maxroll, PoE Vault and pobb.in, each returning per-field detected value, source excerpt, confidence and a `needsConfirmation` flag, plus a saved snapshot; a partial import (missing class/main skill) is flagged and never presented as a clean success.
- Magnitude-aware, slot-aware stat valuation (`StatValuationEngine`) feeding the main decision directly; category analysis; equipped comparison with character-total impact; leveling from level 10 with real milestones and a weakest-slot search.
- Structured modifier catalog (DB-seeded, catalog-first classification with an explicit low-confidence regex fallback), correct hybrid-modifier handling, and local/global classification driven by the catalog.
- Crafting as a real state machine (`craftingStateMachine.ts`): legal-action evaluation, apply/undo, continue-vs-sell-vs-buy comparison, and a non-destructive "What if?" simulator with a persisted, opt-in-confirm crafting history.
- Exact/functional/90%/80%/70%/build-fit market searches; resilient provider; outliers, price-fix cluster detection, sample/confidence and quick/fair/listing estimates; per-comparable "why this price" explanation.
- Market history snapshots recorded only from verified live/relaxed-live searches, with a rising/falling/stable trend and an explicit "not a confirmed sale" caveat — never inferred liquidity from absence of data.
- Persistent per-character profiles with equipment, live-computed Build Doctor diagnosis (resistances/attributes/Spirit/defence, dependency-aware "don't swap this yet" alerts), and auto-recorded analysis history.
- Operational patch updater for the modifier catalog: stage → schema-validate → regression-test against known fixtures → diff vs. active → activate only if regression passes → rollback → deprecate (nothing is ever silently replaced or deleted).
- Beginner/Advanced dual-layer UI sharing one structured result (a plain-language `beginnerSummary` plus optional technical detail tables, never a second computation); simplified 3-step home page (paste → character/build → analyze) with an Advanced Options section holding equipped comparison, market/conversion, manual listings, item-spec overrides and the trade-URL inspector.
- Four independent evaluations (build fit / upgrade value / market value / craft potential) assembled into a 5-state main decision, plus opportunity analysis (better alternatives, buy-vs-craft, wasted stats) reusing the same market/stat data — no parallel scoring or search path.
- Modifier breakdown, crafting plan, saved checks and a data-health / patch-updater admin screen.
- Patch/source/version schema for knowledge, market evidence, history and equipment.

## Requires deployment data or external configuration

- A complete current-game dump of every base, modifier, essence, omen, rune and currency rule is not bundled; these facts must come from an authoritative feed and must not be guessed. The modifier catalog carries structural facts only (group/local/hybrid/tags) — no invented tier or roll-range tables — and the patch updater lets a verified feed be staged and activated once one exists.
- The official market adapter is transport-injected and needs authorized Trade2 configuration. Failure returns no listings and explicitly says no price was inferred.
- Screenshot OCR is not enabled. Clipboard is the accurate path; any future OCR must label uncertain extraction as low confidence.
- Completed sales are shown only when a provider supplies them; asking prices are never relabeled as sales. Market history snapshots are explicitly labeled as listing-price evidence at capture time, not confirmed sales.
- Crafting currencies remain a static in-memory catalog (`craftingCurrencies.ts`) — not yet wired through the same versioned patch-updater pipeline as the modifier catalog; `crafting_currencies` exists in the DB but is currently write-only (seed data, not runtime-read).

## Verified snapshot

- 193 backend unit tests, 24 API integration tests and 21 frontend tests pass.
- Backend/frontend TypeScript and Vite production build pass.
