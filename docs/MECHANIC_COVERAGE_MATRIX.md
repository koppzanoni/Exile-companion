# Mechanic coverage matrix

Audit date: 2026-07-15  
Target patch: 0.5.4b Hotfix 3  
Meaning: `covered` is deterministic code with tests; `partial` is safe withholding/foundation; `absent` must not influence a recommendation as fact.

## Implemented foundation update — 2026-07-15

| Domain | New coverage | Remaining limitation |
|---|---|---|
| roster | versioned 0.5.4b catalog, checksum, staging, explicit activation, rollback/fallback and patch compatibility | automatic official ingestion is intentionally absent |
| actor scope | player, minion, companion, tamed beast, totem, clone/illusion, granted effect and target state | modifier parser does not yet annotate every legacy modifier |
| Spirit | weapon-set availability, reservation efficiency, roster, companion limit and explicit unknown state | UI collection of the complete roster is still partial |
| Spirit Walker | component coverage and deterministic Spirit/Idolatry constraints | AI/contact/command/revive/possession effective uptime unknown |
| Martial Artist | Hollow transition contract and component coverage | bell/illusion targeting and Combo rotation damage unknown |
| shared integration | Analyzer, Build Doctor and Gemini receive one foundation result | exact damage remains withheld for uncovered components |

| Domain | Current coverage | Evidence in code | Critical missing representation | Safe behavior now | Priority |
|---|---|---|---|---|---|
| Versioned skill data | Partial | `skillMechanicProfiles.ts`, `skill_profiles`, `catalog_versions` | only Ice Shot, Spark, Explosive Shot; active catalog not broad roster | unknown profile returns unknown | P0 |
| Conversion / gain-as-extra | Covered foundation | `offenceEvaluator.ts` | component-specific modifier scopes | normalized conversion; tested overconversion | P1 |
| Attack/spell timing | Partial | `offenceEvaluator.ts` | fixed use time, animation breakpoints, repeats | withhold on missing input | P1 |
| Projectile policy | Covered foundation | `ProjectilePolicy` | skill-specific return/chain/fork/ground collision catalogs | no automatic shotgun | P0 maintained |
| Crossbow cycle | Partial | reload/bolt cycle | ammo switching, immediate reload, empowered clips, Emergency Reload | damage withheld where effectiveness missing | P0 |
| Melee/slam/aftershock | Absent | legacy directional weights only | hand selection, fissures, aftershock geometry, every-Nth-use rotations | no exact DPS | P0 |
| Spear hybrid | Absent | none | melee versus thrown component, retrieval/ground effects, mobility | no exact DPS | P0 |
| Shapeshifting/Talisman | Absent | none | form state, transformed base attack, swap time, form-limited stats | no recommendation based on form | P0 |
| Critical expectation | Partial | scenario critical chance/bonus | base override, Critical Weakness, lucky/forced crit, local/global distinction | excluded if chance absent | P1 |
| Accuracy | Partial | scenario hit chance | target evasion/level and skill exceptions | missing input blocks exact attack DPS | P1 |
| Damaging ailments | Foundation only | `ailmentEvaluator.ts` | patch formulas, duration, magnitude, stacks, target threshold | Poison and stack requirements enforced; penetration ignored | P0 |
| Non-damaging ailments/control | Absent | result types only | Shock/Chill magnitude, Freeze/Electrocute/Pin/Stun/Immobilise buildup and thresholds | unknown | P0 |
| Armour | Safe withholding | `defensiveEvaluator.ts` | authoritative patch formula and hit-size scenarios | never shows generic percentage | P0 |
| Evasion/Deflection/Block | Legacy totals only | parser/stat valuation | entropy/chance scenario, eligibility, blocked-hit damage, caps | directional score only | P1 |
| Life/ES/Runic Ward/mana protection | Partial | totals and basic pool | ordering, bypass, recharge timeline, current-state sacrifice | simplified scenario declares assumption | P0 |
| Recovery | Absent deterministically | legacy weights | regen, recoup, leech, flask/remnant pickup, mapping versus bossing | not converted to EHP | P1 |
| Spirit/reservation | Partial | character totals, `ReservationPlan`, roster validator | per-weapon-set roster, item-granted exceptions, efficiency domains | gaps/unknown; no silent roster success | P0 |
| Minions/companions | Scope foundation | `actorStatScope.ts` | skill profiles, active count, AI/contact, revive, command cooldown, Presence | player stats do not leak without explicit scope | P0 |
| Totems | Absent | generic actor name only | placement, limit, survival, inheritance, reservation | unknown | P1 |
| Trigger Energy/meta skills | Absent | contract discussion only | Energy generation/threshold/overflow, internal cooldown, socket costs | no trigger DPS | P0 |
| Charges/Combo | Absent | generic build weights | generation/consumption, cap, uptime, weapon-set retention | no permanent assumption | P0 |
| Ascendancy granted skills | Absent catalog | none beyond normal main skill | Mirage, Djinn, Hollow, spirits, Archon, Foresight etc. | omitted from exact output | P0 |
| Equipment transforms | Absent | crafting state machine does not model ascendancies | Fists of Stone, Smith rules, rune body sockets, extra ring slot | current item only; future potential separated | P0 |
| Transition bundles | Foundation | `transitionBundles.ts` | versioned requirements per archetype | caller-declared bundle can block | P0 |
| Replacement awareness | Strong legacy | Analyzer comparison/stat valuation | deterministic offence/defence deltas for all mechanics | removes equipped item for tracked totals | P0 maintained |
| Craft current versus option value | Partial/strong | crafting state machine and UI | complete 0.5.4b operation catalog/probabilities | best possible craft not added to combat score | P1 |
| Meta/popularity | Intentionally excluded | research policy | versioned observational sampler | never raises combat score | Correct |

## Ascendancy blockers not representable today

| Ascendancy family | Blocker |
|---|---|
| Spirit Walker | multiple companion actors, Presence, movement-earned Wisps, Owl empowerment, rotating possession, Idols versus non-Idol Augments |
| Martial Artist | illusion/bell actors, Combo timeline, body rune sockets, glove base/explicit transformation, weapon-set Combo retention |
| Disciple of Varashta | Djinn-granted components and actor attribution |
| Smith of Kitava | item legality and equipment transformation rules |
| Tactician | ally/banner scope, Pin-to-disable, totem and Supporting Fire components |
| Shaman | Spirit from empty Charm slots and corresponding lost charm utility |
| Oracle | random Foresight, exclusive passive topology, forced crit trade-off and immobilise timeline |
| Abyssal Lich | regular-to-alternate node replacement, Umbral Souls, self-Offering, apparition repeats and ES sacrifice |

## Required invariant

Until a row becomes covered with patch-pinned data and regression tests, the UI may explain the missing mechanic but must not include it in exact DPS, EHP, upgrade score, or Gemini-authored numbers.
