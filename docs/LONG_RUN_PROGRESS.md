# Long improvement run

## Roster and ascendancy foundations — 2026-07-15

Patch verification: the official GGG Early Access patch index still listed **0.5.4b Hotfix 3** as the newest live entry when rechecked on 2026-07-15.

Baseline note: the first combined baseline command exceeded the terminal execution window before returning buffered output. Commands were subsequently split; the pre-change backend suite was 238 unit tests plus 32 integration tests, frontend 29 tests, and both builds had passed in the immediately preceding research run. No existing worktree changes were discarded.

Completed:

- [x] Versioned roster schema with patch, data version, official source, verification date, confidence, limitations, compatibility, checksum and staged/active/deprecated lifecycle.
- [x] Active 0.5.4b catalog: 8 playable bases, 22 regular ascendancies, Abyssal Lich alternate, and four planned/unavailable bases.
- [x] Regression validation rejects wrong Spirit Walker/Martial Artist ownership and incorrect counts.
- [x] Safe fallback is labelled `fallback`; patch mismatch is unsupported rather than remapped.
- [x] Migration 15 adds roster payload storage while reusing `catalog_versions` activation history.
- [x] Build and Character selectors consume `/api/roster`, retaining the local catalog only as an explicit availability fallback.
- [x] Character writes reject known planned classes and known wrong class/ascendancy pairs; unknown legacy values remain preservable.
- [x] Actor scope separates player, minion, companion, tamed beast, totem, clone/illusion, granted ascendancy effect and enemy/target state.
- [x] Spirit feasibility recalculates available/reserved Spirit, roster and companion limits per active weapon set; missing values remain null/unknown.
- [x] Spirit Walker coverage records its components and unknown command/AI uptime independently. Idolatry uses only an explicit Augment count.
- [x] Martial Artist coverage records its components independently; Hollow/unarmed gates gloves, requirements, defences, skill, Combo, runes and weapon set.
- [x] Analyzer, Build Doctor and Gemini consume the same `analysisFoundations` object.
- [x] Analyzer and Build Doctor display roster patch, Spirit state, unknown components and critical transition regressions.

Validation during implementation:

- backend focused foundations: 17/17 passed;
- backend full unit suite: 249/249 across 40 files;
- backend integration: 34/34 passed;
- backend and frontend TypeScript typechecks passed;
- a frontend mock returned an empty roster response and initially crashed the Build page; the fallback guard was corrected and the affected suite then passed 3/3.

Final full frontend, lint, E2E, Docker and smoke results follow after the final validation pass.

Final validation:

- lint passed;
- backend unit tests: 249/249 in 40 files;
- backend integration tests: 34/34;
- frontend tests: 29/29 in 14 files using one worker; the default parallel run exposed one timing-sensitive Dashboard test, which passed alone and in the serial full suite;
- backend and frontend production builds passed;
- Playwright E2E: 6/6 passed, including desktop, mobile, language, character journey and deterministic evidence withholding;
- `docker compose config --quiet` passed;
- `docker compose build backend frontend` did not finish inside the 120-second terminal window. Images retained their prior timestamps and backend/frontend were not started; worker and backup remained running. HTTP smoke on ports 3001 and 8080 therefore could not connect. No volumes were deleted and no existing service data was modified;
- final `git diff --check` result recorded after documentation update.

## Current-patch research run — 2026-07-15

Scope: research and modelling only for the live Path of Exile 2 state. No speculative scoring formulas, external mutations or deployment.

Baseline:

- [x] No repository `AGENTS.md` found; existing local instructions and dirty worktree preserved.
- [x] Required research, source, revision, Gemini and repository documentation reviewed.
- [x] Existing offence, ailment, defence, actor-scope, transition and Build Doctor contracts audited.
- [x] Lint passed.
- [x] Backend unit suite passed: 238 tests in 39 files.
- [x] Backend integration suite passed: 32 tests.
- [x] Frontend suite passed: 29 tests in 14 files.
- [x] Backend and frontend production builds passed.
- [x] `git diff --check` passed (line-ending warnings only).

Research progress:

- [x] Live line confirmed as 0.5.4b Hotfix 3 on 2026-07-15; league recorded as Runes of Aldur.
- [x] Eight playable bases separated from four planned/unavailable bases.
- [x] All 22 regular ascendancies mapped; Abyssal Lich kept as a separate alternate.
- [x] Spirit Walker and Martial Artist received dedicated mechanic and modelling audits.
- [x] Existing app taxonomy corrected: Spirit Walker moved from Druid to Huntress; Martial Artist added to Monk.
- [x] Representative archetype and skill-family coverage created for every ascendancy.
- [x] Actor scope, Spirit/weapon-set, shapeshift, projectile, defence, ailment, rotation and crafting gaps recorded.
- [x] Source conflicts and rejected evidence patterns recorded.
- [x] poe.ninja observation explicitly limited to dated co-occurrence; no popularity score introduced.
- [x] Video leads separated from directly verified evidence; unavailable direct timestamps are not fabricated.
- [x] Implementation backlog ordered by correctness dependency and confidence.

Artifacts:

- `docs/CLASS_ASCENDANCY_MATRIX.md`
- `docs/MECHANIC_COVERAGE_MATRIX.md`
- `docs/SOURCE_CONFLICT_LEDGER.md`
- `docs/VIDEO_RESEARCH_LEDGER.md`
- `docs/BUILD_ARCHETYPE_MATRIX.md`
- `docs/IMPLEMENTATION_BACKLOG.md`
- refreshed `docs/ITEMIZATION_RESEARCH.md`

Remaining validation for this run:

- [x] Re-ran the affected frontend taxonomy test through the full suite: 29/29 frontend tests passed; lint, backend tests and both builds also passed.
- [x] Verified local Markdown targets and re-opened the authoritative patch/roster/mechanic sources used for live-state claims. Hosts or media that could not be directly inspected remain labelled indexed/unverified.
- [x] Final `git diff --check` passed (line-ending notices only), and the scoped code diff contains only the corrected taxonomy and regression assertions.

## Consolidation run — 2026-07-14

Scope: consolidate the accumulated character, Build Doctor, shopping, snapshot, Gemini, market, dashboard, onboarding, localization, accessibility and production work without discarding the existing dirty worktree.

Baseline status:

- [x] Repository instructions and worktree inspected; no `AGENTS.md` exists in this repository.
- [x] Existing documentation, design reference, CI, Docker and E2E structure inventoried.
- [ ] Full lint, unit, integration, build and E2E baseline.
- [ ] Compose validation and Docker engine check.

Execution checklist:

- [ ] Audit, source matrix and encoding/consistency corrections.
- [ ] Versioned data and safe unknown-data fallbacks.
- [ ] Character/OAuth reconciliation and source comparison.
- [ ] Build Doctor, shopping list and snapshot consolidation.
- [ ] Gemini, market, sales and active-character dashboard.
- [ ] Onboarding, localization and accessibility.
- [ ] Production/security review, complete validation and Docker smoke test.

Safety constraints retained: public, official and local equipment remain independent; destructive mutations require confirmation; unknown quests/DPS/crafting costs remain unknown; no external deployment, commit or credential mutation is authorized.

## Completed foundations

- Route-level code splitting, accessible loading state and render recovery.
- Secure sessions, user ownership, PoE OAuth ownership and account export/deletion.
- Gemini memory, usage telemetry, configurable budgets and prompt-injection guard.
- Dedicated market worker with locking/backoff and a scheduled verified backup worker.
- Real backup/restore tests, including corrupt-backup rejection and safety-copy preservation.
- CI pipeline for dependency audit, unit/integration tests, production build, Chromium E2E and Compose validation.

## Current autonomous run — 2026-07-14

Baseline and implementation checklist:

- [x] Baseline: tests, production build, E2E and repository audit.
- [x] Versioned character-data catalog storage/API with explicit source, patch, version and confidence.
- [x] Exact `PassiveTree-0.5` topology from the pinned GGG export, with pan, zoom, id/name search, typed nodes, tooltips and a safe unsupported-version fallback.
- [x] Version-aware quest coverage: confirmed rewards are retained and missing rewards remain unevaluated without an exact catalog.
- [x] Rich public equipment, skill/support and source-reported DPS normalization.
- [x] Immutable public-profile snapshots, comparison API and timeline UI.
- [x] Gemini server-verified context now includes public profile, deterministic findings and sales history; existing injection, size, rate and budget controls remain active.
- [x] Proactive evidence-backed resistance, passive, quest and skill findings.
- [x] Responsive character-profile UI, reduced-motion support and keyboard tab navigation.
- [x] Production headers, proxy-aware rate-limit configuration and expanded operational documentation.
- [x] Final automated validation and real-profile browser QA on desktop/mobile.

## Delivered in this run

- Migration 13 adds versioned character catalogs and immutable public-profile history.
- Catalog resolution is exact-only; unsupported versions expose a reason instead of substituting nearby data.
- Every public import creates an audit snapshot while the latest-profile table remains the fast read model.
- Snapshot comparison covers stats, passive ids/counts, skills, quests and public equipment count.
- The real Kaaiiseerr profile was used for validation: 12 public items and source-reported Lightning Arrow DPS were normalized.
- The passive visualization loads a generated 5,150-node catalog sourced from GGG, validates the exact version, and uses the synthetic allocation fallback only for unsupported versions.
- `npm run data:sync-tree` regenerates the compact catalog with its upstream SHA-256 provenance; the generated runtime payload is about 0.9 MB.
- Gemini build prompts now request grounded buy/craft/passive scenarios and receive public profile, diagnostics and catalog compatibility in their structured context.
- ESLint 9 with TypeScript and React Hooks rules is part of the local quality gate.
- Public equipment remains separate from local/official equipment and cannot overwrite either through this flow.
- The Gemini context is assembled on the server from owned character records, local equipment, build diagnosis, loadout, purchases, calibration, alerts, public profile diagnostics and sales.

## External-data limitations retained intentionally

- The exact `PassiveTree-0.5` topology is supported. Future tree versions remain unsupported until a separately validated catalog is generated.
- No validated patch-specific quest catalog was available locally, so acts, quest names, choices and missing rewards are not asserted.
- Public equipment inventory ids are normalized as returned; canonical local slot reconciliation still requires explicit user confirmation through the official OAuth flow.
- DPS is displayed only when the source reports a numeric value. The app does not calculate or extrapolate missing DPS.
- A production deployment still requires real domain/TLS, OAuth credentials, external backup storage, monitoring destinations and an operator-installed catalog feed.

## Validation result

- Backend unit tests: 219 passed across 36 files.
- Backend integration tests: 29 passed.
- Frontend tests: 24 passed across 11 files.
- Browser E2E: 2 passed; authenticated account lifecycle E2E: 1 passed.
- Production TypeScript/Vite build passed.
- Browser QA passed at 1280 px and 390 px with no document overflow.
- ESLint, `git diff --check` and `docker compose config --quiet` passed.
- Added Build Lab scenario cards for buying, crafting, and passive/quest work, with explicit confidence and missing-data language plus grounded Gemini prompts.
- Added deterministic stale-listing advice backed only by local age/price history, including conservative optional repricing and no completed-sale inference.
- Added an installable PWA shell, icon, manifest, and network-first static cache that deliberately excludes every `/api/` request.
- OAuth reconciliation and immutable snapshots were retained as the synchronization foundation instead of adding a competing sync path.
- Local Docker image build is temporarily blocked by Docker Desktop itself: after a WSL shutdown/restart the engine still never exposed its init API. No project image or container was created in this attempt.

Constraints recorded before implementation:

- The working tree already contains a large set of intentional uncommitted changes; they must be preserved.
- Public poe.ninja data is treated as an independent source, never as an official GGG API.
- Missing quests and passive names are shown only when a catalog exactly matches the reported tree/patch.
- Public imports never overwrite local or official equipment silently.
- No deployment, commit, push or external credential mutation is authorized in this run.

## Final consolidation checkpoint — 2026-07-14

Completed in the consolidation pass:

- Audited the existing dirty worktree and preserved all prior changes.
- Added `docs/SOURCE_MATRIX.md` with explicit authority, overwrite and conflict rules for local, GGG, poe.ninja, Trade2, Gemini and manual data.
- Migration 14 persists active character, language, experience mode and onboarding progress per authenticated user, and adds auditable Gemini conversation archival.
- Dashboard service indicators now report evidence-backed states; Trade2 remains `unknown` until a live query is executed.
- The active character retains a safe local fallback while synchronizing to the backend for signed-in users.
- Gemini conversations can be listed, reopened, continued, started and archived per character. Archival is confirmed and does not delete message history.
- Existing versioned catalogs, OAuth reconciliation, Build Doctor, roadmaps, purchase transaction, immutable snapshots, market/sales journal and grounded Gemini paths were retained instead of duplicated.

Final validation:

- ESLint: passed.
- Backend unit: 223 passed across 37 files.
- Backend integration: 30 passed.
- Frontend: 27 passed across 13 files.
- Production backend/frontend build: passed.
- Playwright primary journey: 2 passed.
- Playwright authenticated account lifecycle: 1 passed.
- Docker Compose config/build/up: passed; backend, frontend, worker and backup started.
- HTTP smoke: backend health and service evidence passed; frontend returned 200.
- Persistence smoke: backend health passed before and after container restart.
- Backup worker created and verified a backup without deleting existing volumes.
- Browser QA found and fixed a syntax error in the PWA service worker; the rebuilt frontend registers without console errors.

Remaining deliberate limits:

- Full string extraction is not complete. The persisted `en`/`pt-BR` preference and formatting contract are present, but many legacy screens remain English-only.
- Live GGG OAuth requires an approved client, redirect URI and user authorization. Mocked/authenticated flows remain testable without those credentials.
- Trade2 is never marked online by the generic health route; a successful live market request is required as evidence.
- Exact new passive, quest, modifier and crafting-currency patches require validated upstream catalogs and explicit activation.
- External TLS/domain, off-host backup storage and monitoring destinations remain operator tasks. No external service was changed.

## Internationalization run — 2026-07-14

Baseline before implementation:

- No repository `AGENTS.md` was present.
- Existing dirty worktree was inventoried and preserved.
- ESLint passed.
- Backend unit tests: 223 passed across 37 files.
- Backend integration tests: 30 passed.
- Frontend tests: 27 passed across 13 files.
- Production backend/frontend build, Compose validation and `git diff --check` passed.

Implementation checkpoint:

- Added one typed frontend i18n provider for `en` and `pt-BR`, with English fallback and compile-time catalog parity.
- Preference precedence is persisted backend, explicit local choice, compatible browser language, then English.
- Explicit language changes update immediately, persist locally for visitors, persist remotely for authenticated users and synchronize after login.
- `document.documentElement.lang` follows the selected locale.
- Added centralized `Intl` number, percentage, date, date/time, compact-number and duration formatters.
- Added accessible language selectors to the top bar, Settings and onboarding foundation.
- Localized the navigation shell, route loading/error states, Settings core controls and onboarding checklist.
- Replaced the false `TRADE2 ONLINE` shell badge with an explicit unknown state; live evidence remains page/API-specific.
- Gemini chat receives the selected locale as a validated field and is instructed to answer in that language without translating official game names.
- Added official OAuth registration/operator guidance in `docs/oauth-ggg.md`; no external registration was attempted.

Final internationalization validation:

- Translation validation: 132 matching, unique and used keys in English and Brazilian Portuguese.
- Dashboard, application shell, authentication, Settings core and onboarding foundation are bilingual.
- Legacy feature-heavy pages remain partially localized; game/source payloads intentionally remain unchanged.
- Frontend tests: 29 passed across 14 files. Backend remained at 223 unit and 30 integration tests passed.
- Playwright: 4 primary E2E tests passed, including immediate switch, reload persistence and 390 px Portuguese layout; authenticated lifecycle: 1 passed.
- Docker backend, frontend, worker and backup images rebuilt and started. Backend remained healthy after restart; frontend returned HTTP 200.
- Browser QA passed at 1280, 900 and 390 px with no horizontal overflow, technical translation keys, unnamed buttons or console errors.
- No external service, credential or deployment was changed.

## Feature-page localization checkpoint — 2026-07-14

- Expanded the validated bilingual catalog from 132 to 187 matching keys.
- Localized the complete static interface of Gemini Coach, including history, conversation actions, evidence, confidence, errors and accessible controls. Game/source content and user prompts remain unmodified.
- Localized the Sales dashboard, filters, summaries, empty states, recommendations and accessible labels; external item names and source-provided values remain unchanged.
- Localized the Build Doctor entry workflow: page introduction, character selection, equipment input, build profile input and primary actions. Its large diagnostic result surface remains a deliberate partial localization target.
- Rebuilt and restarted the frontend container without deleting volumes. Backend remained healthy and frontend remained available on port 8080.
- Validation passed: ESLint, frontend build, 29 frontend tests, 4 Playwright E2E tests, catalog parity/usage check (187 keys) and `git diff --check`.

Remaining localization sequence:

- Complete Characters and public character profile without translating official game/source payloads.
- Complete Build Doctor diagnostic results and Analyzer.
- Localize remaining market/build/leveling feature surfaces and expand route-specific bilingual E2E coverage.

## Analyzer localization checkpoint — 2026-07-14

- Localized the Analyzer hero, item input, character/build selection, primary actions, advanced options, equipped-item comparison, market configuration and key accessible labels.
- Preserved leagues, build names, rarities, item text and other game/source payloads in their original form.
- Added an assertive error region and retained the existing accessible-name contract used by regression tests.
- Reformatted the formerly single-line page implementation to make subsequent review and extraction safer.
- Validation passed: ESLint, production frontend build, 29/29 frontend tests, 4/4 Playwright tests and `git diff --check`.
- Rebuilt and restarted the frontend image; backend stayed healthy and no Docker volumes were removed.

Remaining priority:

- Move the Analyzer's new page copy into the central typed catalog as part of the final string-extraction pass.
- Complete Characters/public profile and the detailed Build Doctor result surface.

## Characters and Build Doctor localization checkpoint — 2026-07-14

- Localized the Characters page header, keyboard-operated tab names, loading state, public poe.ninja import, public profile sections, source navigation, PoE account connection and saved-character list.
- Switched the public-profile update timestamp to the shared locale-aware formatter.
- Preserved character names, leagues, classes, ascendancies, skills, supports, modifiers, findings and other source payloads without unofficial translation.
- Localized the Build Doctor executive diagnosis, coverage, top problem, next upgrade, swap risk, character totals, safety alerts, equipment heatmap and slot-diagnosis headings.
- Kept deterministic diagnostic messages unchanged when they originate from the backend; translating those safely requires structured message codes rather than rewriting source evidence.
- Improved the tab keyboard-focus implementation after ESLint identified ambiguous indexed property access introduced by formatting.
- Validation passed: ESLint, production frontend build, 29/29 frontend tests, 4/4 Playwright tests and `git diff --check`.
- Rebuilt and restarted the frontend container. Backend remained healthy; no volumes or persisted data were removed.

Remaining localization work:

- Character edit/equipment/build/upgrades/evolution detail forms remain partially localized.
- Build Doctor bulk import, simulation, snapshot comparison and roadmap details remain partially localized.
- New page-level bilingual strings still need final extraction into the central typed catalog.

## Character forms and Build Doctor workflow checkpoint — 2026-07-14

- Localized the character create/edit form, including accessible names, class/ascendancy choices, progression, budget, target content, issues and save/create actions.
- Localized the equipment and build-loadout section headings while preserving official class, ascendancy, skill and item names.
- Localized Build Doctor bulk import review, candidate search, swap simulation, snapshot comparison and roadmap save/confirmation actions.
- Fixed delayed creation feedback: success is now announced immediately after the create request succeeds while detailed character loading continues. The message is no longer cleared by the follow-up selection request.
- The fix was verified by the previously failing character-journey E2E; the complete Playwright suite subsequently passed 4/4.
- Final validation passed: ESLint, 29/29 frontend tests, production frontend build, 4/4 Playwright tests and `git diff --check`.
- Rebuilt and restarted the frontend container; backend remained healthy and persisted data/volumes were preserved.

Remaining technical work:

- Translate remaining Characters investment/evolution/market detail headings and Build Doctor low-level score explanations.
- Replace backend prose diagnostics with stable message codes plus parameters before localizing evidence-bearing messages.
- Extract page-local bilingual copy into the central typed catalog and extend the unused-key checker across those domains.

## Structured diagnostic messages checkpoint — 2026-07-14

- Added stable Build Doctor diagnostic codes, typed parameters and preserved original prose for empty equipment, unknown Spirit target, relative-only budget guidance, attribute dependencies and resistance dependencies.
- Kept the existing `message` and `limitations` fields intact, so older consumers and saved snapshots remain compatible.
- Added `structuredLimitations` and enriched dependency alerts; the frontend types accept both new structured responses and legacy payloads.
- Build Doctor now renders these structured messages in Brazilian Portuguese using factual parameters, while English and unknown codes fall back to the original audited prose.
- Added a backend regression test proving codes are emitted without losing the original limitation text.
- Validation passed: ESLint; backend 224/224 unit tests and 30/30 integration tests; frontend 29/29 tests; backend/frontend production builds; Playwright 4/4; `git diff --check`.
- Rebuilt backend and frontend Docker images and restarted services without deleting volumes. Backend returned healthy; worker and backup remained running.

Next structured-message coverage:

- Extend codes to strengths, gaps, next move, upgrade reasons, Spirit notes and stat-valuation explanations.
- Move message rendering into a shared typed formatter/catalog instead of keeping Build Doctor-specific formatting in the page.

## Build-aware item-analysis precision checkpoint — 2026-07-14

- Fixed a scoring defect where build and slot weights were recorded on stat contributions but did not affect the final weighted average. Required/high-priority build stats now materially influence the score.
- Candidate comparisons now remove the equipped item's resistances, attributes and Spirit from character totals before valuing the replacement. Candidate and equipped item are evaluated against the same pre-slot baseline.
- Reused the replacement-aware context in opportunity analysis, preventing a second inconsistent score path.
- Build priority minimums now act as fallback breakpoints for attributes, Spirit and resistance caps when an explicit requirement/cap is absent.
- Added `precisionContext` to analysis responses with build profile identity/source, character-total source, replacement-awareness, resolved requirements/caps and meta status.
- Meta remains explicitly `unknown` when no validated patch-specific catalog is active; build priorities are used instead of invented popularity/spec claims.
- Added regression tests proving build/slot weights alter final scoring and that replacement resistance is valued after removing the equipped item.
- Validation passed: ESLint; backend 225/225 unit and 30/30 integration tests; frontend 29/29 tests; backend/frontend builds; Playwright 4/4; `git diff --check`.
- Rebuilt backend and frontend Docker images; backend is healthy and worker/backup remain running.

Next precision work:

- Version a sourced meta/build-stat catalog by patch, archetype and content target before enabling meta-based scoring.
- Expand parser coverage for conditional/local modifiers and gem-level modifiers, then calibrate weights against confirmed character outcomes.
- Surface `precisionContext` and coverage/limitations more prominently in the Analyzer UI.

## Deep itemization knowledge-model checkpoint — 2026-07-14

- Expanded the research from general scoring principles into a patch-scoped taxonomy for all eight current base classes and their current ascendancy families.
- Defined separate analysis paths for attack hits, spell hits, damage over time, triggers, persistent/temporary minions, totems, companions, conversion builds and party supports.
- Formalized a constraint-first evaluation pipeline: legality, enablers, post-swap viability, primary scaling, item quality, crafting option value, economics and confidence.
- Added per-slot evaluation requirements, distinct defensive-layer handling, progression-stage detection and multi-item transition bundles.
- Documented why poe.ninja population data, creator guides and Reddit evidence serve different purposes and cannot be merged into an unqualified “meta score”.
- Added a five-level confidence rubric and a target `BuildProfile` schema for versioned, auditable production rules.
- Added direct references for patch notes, mechanics, classes, modifiers, Spirit, minions, Runic Ward, crafting and maintained 0.5 creator builds.

Next knowledge implementation:

- Build the versioned profile registry and modifier-domain parser.
- Implement skill-aware weapon/conversion models and minion/totem inheritance.
- Add transition-bundle scenarios and distinct Runic Ward/deflection calculations.
- Calibrate only against confirmed before/after snapshots, retaining unknown results where coverage is insufficient.

## All-class patch 0.5 research checkpoint — 2026-07-14

- Expanded coverage to every currently documented ascendancy family across Warrior, Ranger, Witch, Sorceress, Mercenary, Monk, Huntress and Druid, including the alternate Abyssal Lich context.
- Inspected maintained 0.5 video-linked guides from specialists including Fubgun, Ronarray, Big Ducks, Raxxanterax, CaptainLance9, PhazePlays, Dreamcore, MisoxShiru, GuyThatDies and others.
- Recorded per-ascendancy archetypes, enabling constraints, slot/itemization consequences and present evidence depth.
- Identified non-generic mechanics that the current scorer must not flatten: Normal body-armour constraints, body-armour ES-to-life conversion, Hollow Palm empty-weapon rules, companion limits, command cooldowns, exact trigger-gem levels, corpse-consumption breakpoints, alternate gem quality and weapon-set-specific skills.
- Added a strict video evidence protocol. The current batch distinguishes inspection of video-linked written explanations from full timestamped video transcription; it does not falsely label every linked video as watched end-to-end.

Remaining research depth before production meta rules:

- Complete timestamped extraction for the selected primary videos and retain quotes only as short internal evidence notes.
- Add at least one independent corroborating maintained source to the thinner Amazon, Tactician and Abyssal Lich profiles.
- Sample patch-filtered poe.ninja distributions per archetype and test co-occurrence without treating popularity as power.
- Convert only confirmed mechanics and corroborated breakpoints into versioned build profiles and regression fixtures.

## Deep crafting and thin-profile research checkpoint — 2026-07-14

- Researched item level, modifier eligibility, quality, catalysts, exceptional bases, augment sockets, runes, Bonded effects, corruption, essences and desecration using patch-current mechanics references.
- Defined a strict split between current combat power and future crafting option value, including irreversible operations, random modifier replacement and unknown probability handling.
- Added current follow-up evidence for Amazon Lightning Spear, Tactician Pin/grenade and Plant/Abyssal Lich profiles.
- Upgraded Tactician from speculative-only coverage to maintained 0.5 guide coverage, while retaining unknown boss/control details.
- Documented Abyssal Lich's ES-sacrifice/cast-frequency coupling and alternate-ascendancy availability as required analysis inputs.
- Added an anti-pattern library for future regression fixtures, covering common false upgrades involving DPS, gem levels, quality, Spirit, minions, weapon sets, defensive layers, runes and crafting.

Next deep-research block:

- Defensive formulas and maximum-hit modelling by damage type and hit size.
- Ailment, poison, bleed, ignite, freeze, shock, exposure and armour-break scaling domains.
- Skill-specific weapon calculations and conversion order for representative attack archetypes.
- Timestamped primary-video evidence for the strongest and weakest-covered profiles.

## Defensive formulas, ailments and conversion checkpoint — 2026-07-14

- Documented hit-size-dependent armour modelling and separated average mitigation from maximum-hit survival.
- Separated evasion, patch-0.5 Deflection, block and content eligibility instead of combining them into one percentage.
- Recorded ES damage order, chaos interaction, bleed/poison bypass and the reciprocal recharge-delay model; preserved Runic Ward as a different system.
- Distinguished resistance maximums, overcap, Exposure, curses and hit-only Penetration, including the zero-resistance marginal-value case.
- Documented PoE2's non-recursive/final-type conversion rules and overconversion normalization, preventing PoE1-style double counting.
- Added distinct Ignite, Poison, Shock, Chill, Freeze and Armour Break requirements and failure cases.
- Defined the target defensive report with hit-size scenarios, maximum hits, recovery mechanisms, thresholds, uptime, sources and confidence.

Next deep-research block:

- Derive representative offence pipelines for bow, spear, crossbow, quarterstaff/unarmed, mace/slam, spell hit, DoT, minion, totem and trigger builds.
- Inspect primary video timestamps for each representative pipeline and compare the shown loadouts with the written variant.
- Build a source-conflict ledger and identify exactly which conclusions remain insufficient for production scoring.

## Implementable offence-pipeline checkpoint — 2026-07-14

- Defined ordered pipelines for generic weapon attacks, bow/spear components, crossbow clip/reload cycles, spell hits, damaging ailments, minions/companions, totems and trigger/meta gems.
- Added skill-specific hand and dual-wield handling instead of averaging both weapons.
- Added projectile collision/sequence policy, preventing additional projectiles from becoming automatic single-target multipliers.
- Modelled crossbow sustained damage around bolts, reload, ammo preservation, mana-per-reload and empowered burst windows.
- Separated spell gem-level benefit from its requirement and resource-cost consequences.
- Added minion roster/Spirit/AI/revive and totem placement/limit/survival inputs.
- Added meta-gem Energy, overflow, combined socket costs, trigger conflicts, Spirit and resource-sustain requirements.
- Defined versioned `SkillMechanicProfile`, `RotationScenario` and `OffenceResult` contracts for implementation.
- Established that exact DPS must be withheld when a materially relevant skill component or overlap rule is not covered.

Next deep-research block:

- Populate representative skill profiles for one build per weapon/archetype using patch-current data.
- Create the source-conflict ledger and video-timestamp extraction records.
- Map these contracts onto the current backend types and identify the smallest safe implementation slice.

## Current-engine mapping checkpoint — 2026-07-14

- Mapped the research contracts onto existing `BuildFitProfile`, `statValuationEngine`, `buildFitScoring`, versioned skill/modifier tables and the crafting state machine.
- Identified overlapping stat interpretation between `buildFitScoring` and `statValuationEngine` as the main contradiction risk.
- Documented missing representations for conversion order, gain-as-extra, component-specific mechanics, transition stages, reservation rosters, crossbow cycles and exact crit semantics.
- Defined an incremental architecture: versioned skill-profile data, one pure offence evaluator, explicit mechanic coverage, existing state-aware valuation as fallback, and gradual removal of duplicate parsing.
- Selected the smallest safe implementation research targets: one simple weapon attack, one spell and one crossbow skill, with exact output withheld whenever coverage is partial.

## External itemization research checkpoint — 2026-07-14

- Reviewed official GGG patch/ascendancy material, mechanics references, patch-labelled creator builds, poe.ninja representations and current Reddit build/crafting discussions.
- Documented the evidence hierarchy, confirmed mechanics, build-variant requirements, meta policy and target analyzer model in `docs/ITEMIZATION_RESEARCH.md`.
- Established that popularity cannot raise combat score, creator claims cannot become facts without corroboration, and meta remains unknown without a validated patch-specific catalog.
- Identified the next core model additions: local/global modifier scope, affix topology, variant transitions, required uniques/enablers, gem/support requirements, conversion-aware weapon DPS, defence-base compatibility and content-target priorities.

## Deterministic itemization foundation implementation — 2026-07-14/15

Baseline before this slice:

- lint passed before the new slice;
- backend: 225 unit tests and 30 integration tests passed;
- frontend: 29 tests passed;
- backend and frontend production builds passed;
- the combined E2E baseline attempt exceeded its execution window and was scheduled for a dedicated rerun;
- the worktree was already extensively modified and all pre-existing changes were preserved.

Implemented:

- Added versioned contracts for skill profiles, components, conversion, projectile policy, rotation scenarios, mechanic coverage, breakpoints, evidence, reservation, offence and defence scenarios.
- Added validated patch-0.5.x profiles for Ice Shot, Spark and Explosive Shot. Every profile carries source, data version, confidence and explicit limitations.
- Reused `skill_profiles` and `catalog_versions`: built-ins are seeded, runtime reads only the explicitly active skill catalog, and admin endpoints support staging, validation, activation and rollback without automatic activation.
- Added a pure deterministic offence evaluator with conversion normalization, gain-as-extra, attack/cast timing, hit chance, crit expectation, crossbow reload cycles, ammunition preservation, movement uptime and resource balance.
- Additional projectiles and unknown secondary geometry do not multiply boss DPS. Spark and Ice Shot secondary geometry are withheld; Explosive Shot damage is withheld because the compatible source does not expose its damage effectiveness.
- Analyzer and Build Doctor now reuse the same evaluator and expose additive API fields while preserving legacy response fields.
- Gemini receives the structured deterministic result as context; it does not replace or mutate the calculation.
- Added UI panels for patch compatibility, exact-DPS availability, burst/sustained output, resource rate, missing inputs, excluded components, assumptions and source evidence.
- Expanded build stages with `established`, `transition` and `aspirational`, and added an explicit transition-bundle validator.
- Added conservative foundations for ailments, defence-by-hit-scenario, actor/minion stat scope and Spirit/companion roster validation. Unknown armour formulas remain unknown rather than being approximated.
- Added regression coverage for overconversion, false shotgun, patch mismatch, missing geometry, crossbow reload, resource coverage, Poison/Ignite rules, armour withholding, transition packages and player/minion stat separation.

Validation after implementation:

- backend unit tests: 238 passed across 39 files;
- backend integration: 32 passed;
- frontend tests: 29 passed across 14 files;
- backend and frontend production builds passed;
- i18n catalogs: 187 matching keys in English and pt-BR;
- `docker compose config --quiet` passed;
- first lint rerun found one local `prefer-const` issue and `git diff --check` found one trailing space; both were corrected before final validation.
- final lint and `git diff --check` passed;
- Playwright: 6/6 passed, including deterministic offence evidence/withholding and a 390 px overflow check;
- Docker backend/frontend images rebuilt successfully; backend, frontend, worker and backup were started without deleting volumes;
- backend detailed health, database health and frontend HTTP smoke passed; all three skill profiles remained present after a safe backend restart;
- the worker logged two expected transient `fetch failed` events while the backend was intentionally restarting, then resumed normal processing; worker and backup were recreated on the new backend image.

Intentionally incomplete / unknown:

- Exact Ice Shot and Spark DPS remains unavailable until target hit chance, resource recovery, crit inputs and verified geometry/scenario inputs are supplied.
- Exact Explosive Shot damage remains unavailable until a compatible patch source provides damage effectiveness and the weapon provides reload timing.
- Full trigger Energy, CoC rotation, ailment thresholds, minion AI uptime, totem inheritance and PoE2 armour formula catalogs still need verified patch data.
- Transition bundles currently validate explicit caller-declared requirements; production build-specific bundle catalogs are not inferred from popularity.
