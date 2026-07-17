# Research-driven implementation backlog

Prepared: 2026-07-15  
Target baseline: 0.5.4b Hotfix 3

Priority combines user impact, evidence confidence and dependency order. No item below authorises speculative formulas.

## Implementation status — 2026-07-15

The first P0/P1 foundation block is implemented: versioned roster lifecycle, class ownership validation, actor-scope domains, weapon-set Spirit feasibility, Spirit Walker constraints, Martial Artist component coverage and the Hollow/unarmed transition gate. Remaining work is full legacy-modifier annotation, UI collection of all scenario inputs, and exact offensive profiles where current-patch evidence is still missing.

## P0 — correctness gates

1. **Versioned roster catalog** — replace remaining fixed class/ascendancy arrays with a patch-aware catalog. Validate exactly 8 playable bases, 22 regular ascendancies and Abyssal Lich as an alternate for the verified patch. Risk: high if stale data silently enters UI or scoring.
2. **Actor-scope enforcement** — require every parsed modifier to declare player, minion, companion, totem or granted-effect scope. Reject/withhold ambiguous propagation. Depends on modifier catalog metadata.
3. **Spirit and weapon-set feasibility** — calculate the active persistent/companion roster per weapon set; gate replacements that invalidate reservation, companion count or required skills.
4. **No-false-precision gate** — exact DPS remains unavailable when geometry, target scenario, resource balance, actor scope or a material skill component is unknown.
5. **Patch compatibility at entry points** — Analyzer, Build Doctor and Gemini must expose the same patch-compatibility result and never silently fall back to a different mechanical profile.

## P1 — highest-value mechanic profiles

1. **Spirit Walker package** — model Idols separately from non-Idol Augments, resistance penalty, Spirit reservation efficiency, Presence-scoped player damage, companion damage, unique beast limit and unknown possession/AI uptime. Sources are strong for node wording, weak for uptime.
2. **Martial Artist package** — model Hollow state, body-rune sockets, transformed gloves, Combo, weapon-set retention and Surpassing/Immobilise. Add transition fixtures so an end-state item cannot be recommended early.
3. **Spear profile** — implement one verified Amazon/Ritualist representative with melee/projectile components and explicit geometry.
4. **Druid form-state contract** — represent human/form state, skill source, weapon set and separate attack/spell components before adding Shaman or Oracle scoring.
5. **Crossbow completion** — source damage effectiveness, reload timing and explosion policy for one current skill; keep burst and sustained separate.

## P2 — defences and conditions

1. Versioned armour formula with hit-size scenario and regression tests.
2. Evasion/Deflection/Block scenario contracts and maximum-hit reporting.
3. Recovery model separating mapping kill-state from sustained boss state.
4. Target-rarity-aware ailment threshold and duration catalog.
5. Full state models for Electrocute, Immobilise, Pin, Stun, Armour Break, Exposure, Surpassing and Presence.

## P3 — supports, rotations and crafting

1. Versioned support compatibility catalog by skill component and patch.
2. Trigger Energy/CoC rotation with Spirit, cooldown and resource feasibility.
3. Totem inheritance, shared limits, placement and survival contract.
4. Companion command/revive/AI scenario inputs; never use a guessed uptime as default.
5. Crafting legality catalog for runes, Idols, corruption, desecration and irreversible transforms. Keep possible future power out of current combat score.

## P4 — research infrastructure

1. Importer that stages official patch/skill/support data, validates schema/checksum and requires explicit activation.
2. Evidence ledger schema with URL, patch, access date, confidence, conflict and supersession fields.
3. Reproducible community-test fixture format containing inputs, target, steps, raw observation and patch.
4. Direct video-review workflow that requires original URL and exact timestamp before accepting demonstration evidence.
5. poe.ninja sampler that records league/date/sample size and produces co-occurrence metadata only, never a combat multiplier.

## File-level audit targets

| Area | Required change | Risk | Priority |
|---|---|---:|---:|
| `frontend/src/poeClasses.ts` | move fixed taxonomy behind versioned roster data; current wrong Spirit Walker/Martial Artist mapping was corrected | medium | P0 |
| `backend/src/buildProfiles.ts` | stop treating a small profile set as broad class coverage; attach roster/skill compatibility | high | P0 |
| `backend/src/buildFitScoring.ts` | consume coverage and actor-scope gates; do not add ascendancy-specific duplicate formulas | high | P0 |
| `backend/src/statValuationEngine.ts` | remain directional fallback; label unsupported mechanics and patch | high | P0 |
| `backend/src/skillMechanicProfiles.ts` | expand only through validated staging/activation | high | P1 |
| `backend/src/offenceEvaluator.ts` | add sourced spear/form/trigger components without guessing geometry | high | P1 |
| `backend/src/actorStatScope.ts` | extend to companion, totem and granted ascendancy effects | high | P0 |
| `backend/src/defensiveEvaluator.ts` | add versioned formulas and scenario coverage; preserve unknown | high | P2 |
| `backend/src/ailmentEvaluator.ts` | add threshold/duration/rarity state and missing ailments | high | P2 |
| `backend/src/transitionBundles.ts` | add Spirit Walker, Hollow, shapeshift and trigger bundles | medium | P1 |
| `backend/src/buildDoctor.ts` | surface blockers from the shared evaluators, never local divergent rules | high | P0 |

## Definition of done for any backlog item

- Current-patch evidence and limitations are stored with the mechanic.
- Unknown inputs withhold the affected result instead of becoming zero/default.
- Replacement removes the equipped item and rechecks attributes, resistances, Spirit, requirements and required uniques.
- Analyzer and Build Doctor consume the same deterministic result.
- Unit, integration and UI regression tests cover both success and withholding.
- Gemini receives the result as read-only structured evidence.
