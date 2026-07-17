# Build archetype matrix

Verified: 2026-07-15  
Live target: 0.5.4b Hotfix 3 / Runes of Aldur

This matrix provides representative test and research targets. It does **not** rank builds. `Observed` means a current-patch guide or character demonstrates the configuration; it does not mean best, required or mechanically complete.

## Ascendancy coverage

| Base / ascendancy | Representative archetype | Skill family | Itemisation and breakpoints to model | Stage / evidence |
|---|---|---|---|---|
| Warrior / Titan | two-handed slam | mace, slam, warcry | local weapon damage, attack time, stun/Armour Break, attributes, recovery | campaign→endgame; established family |
| Warrior / Warbringer | warcry/totem melee | mace, warcry, totem | warcry cooldown, totem limits/survival, block and recovery | early maps→endgame; mechanical profile incomplete |
| Warrior / Smith of Kitava | forged armour melee | mace, shield | body-armour transformation, socket/rune state, defences, irreversible equipment state | transition→endgame; current reports are discovery evidence |
| Ranger / Deadeye | Ice Shot bow | bow, projectile | bow local damage, accuracy, projectile policy, crit transition, resist/attribute replacement | campaign→endgame; current guide observed |
| Ranger / Pathfinder | flask/ailment bow | bow, ailment | explicit ailment chance, flask state, sustain, stack limits, boss threshold | established→endgame; formulas incomplete |
| Huntress / Amazon | spear elemental/crit | spear, projectile, melee | weapon requirements, accuracy/crit, close/ranged components, attributes | campaign→endgame; representative family |
| Huntress / Ritualist | Glacial Lance | spear, projectile, cold | projectile geometry, freeze threshold, spear local stats, defensive replacement | established; current guide observed |
| Huntress / Spirit Walker | companion + spear/bow | companion, persistent, attack | Spirit roster, Idols/non-Idol Augments, Presence scope, companion limit, movement uptime | campaign→endgame; deep-research priority |
| Mercenary / Witchhunter | explosive crossbow | crossbow, grenade | reload cycle, bolts/clip, grenade cooldown, burst vs sustained, attributes | campaign→endgame; current guide observed |
| Mercenary / Gemling Legionnaire | gem-level crossbow/minion | crossbow or minion | gem levels/quality, support compatibility, stat requirements, actor scope | transition→endgame; multiple families possible |
| Mercenary / Tactician | cooldown/grenade control | crossbow, grenade, banner | cooldowns, ammunition switching, control-state thresholds, reservation | early maps→endgame; evaluator gaps remain |
| Monk / Invoker | elemental quarterstaff | quarterstaff, elemental attack | local weapon stats, attack speed, ailments, Spirit/persistent skills, defences | campaign→endgame; established family |
| Monk / Acolyte of Chayula | chaos quarterstaff | quarterstaff, chaos | darkness/chaos resources, conversion, leech/recovery, transition bundle | established→endgame; current guide observed |
| Monk / Martial Artist | Hollow unarmed | unarmed, Combo | glove transform, body rune sockets, Combo, weapon sets, bells/illusions, attributes | campaign→endgame; deep-research priority |
| Witch / Infernalist | minion/Infernal Flame | minion, persistent, fire | player/minion separation, Spirit roster, Infernal Flame, recovery | campaign→endgame; established family |
| Witch / Blood Mage | life-cost spell | physical/elemental spell | life cost, recovery, crit, reservation, maximum-hit regression | transition→endgame; sustain must gate recommendation |
| Witch / Lich | chaos DoT/minion | chaos, DoT, minion | DoT components, curse state, minion scope, ES/recovery | campaign→endgame; current guide observed |
| Sorceress / Stormweaver | Spark | elemental spell, projectile | gem level, cast speed, mana sustain, hit-count scenario, Shock, crit/CoC transition | campaign→endgame; deterministic profile partial |
| Sorceress / Chronomancer | cooldown spell | elemental spell, cooldown | cooldown reset/time state, burst window, cast speed, recovery | established→endgame; current guide observed |
| Sorceress / Disciple of Varashta | Djinn elemental spell | elemental spell, persistent | granted skill state, elemental rotation, mana, target scenario | campaign→endgame; current guides observed |
| Druid / Shaman | bear/meteor | shapeshifting, nature spell | form state, weapon-set scope, attack/spell components, Spirit, maximum hit | campaign→endgame; current guide observed |
| Druid / Oracle | plant/nature spell | nature spell, persistent | plant limits/uptime, cast state, Spirit/reservation, boss movement | campaign→endgame; current guide observed |
| Witch / Abyssal Lich (alternate) | abyssal chaos/minion | chaos, minion, persistent | alternate-ascendancy eligibility, minion scope, resource/stack state | endgame alternate; keep separate from 22 regular choices |

## Skill-family inventory and modelling status

| Family | Representative target | Required fields before exact output | Current treatment |
|---|---|---|---|
| bow | Ice Shot | gem level, bow local damage, accuracy, timing, conversion, crit, projectile geometry | profile exists; secondary geometry withheld |
| spear | Glacial Lance / elemental spear | weapon requirements, melee/projectile split, conversion, sequence | research requirement; unknown |
| crossbow | Explosive Shot | clip, fire/reload time, preservation, damage effectiveness, explosion policy | reload foundation exists; exact damage withheld |
| grenade | explosive grenade | cooldowns, fuse, overlap/geometry, crossbow interaction | separate components required |
| mace/slam | representative Titan slam | local weapon damage, attack time, aftershock policy, stun/break | incomplete |
| shield | shield attack/block package | shield-local stats, block scenario, attack component | incomplete |
| quarterstaff | Invoker elemental attack | local weapon stats, sequence, ailment thresholds | incomplete |
| unarmed | Hollow Martial Artist | unarmed base, transformed gloves, Combo, rune sockets | incomplete; transition bundle required |
| elemental spell | Spark | gem-level base, cast time, cost/recovery, hit scenario, crit | profile exists; geometry scenario withheld |
| chaos/physical spell | representative Lich/Blood Mage spell | base/effectiveness, cost, DoT/hit split, actor state | incomplete |
| DoT | Poison/Ignite/Bleed target | explicit chance, magnitude, duration, stack rule, target | conservative ailment foundation only |
| minion/companion | Spirit Walker beast / Witch minion | gem level, actor scope, count, Spirit, command/AI uptime | scope and roster validation only |
| totem | Warbringer target | limit, placement, inherited stats, survival, attack/cast time | unknown until sourced |
| trigger | CoC/energy package | Energy generation/use, cooldown, Spirit, reservation, sustain | exact result withheld |
| shapeshifting/nature | Shaman/Oracle target | form state, skill source, weapon set, plant/companion limit | unknown until sourced |
| warcry/curse/mark | utility package | cooldown/duration, target state, effect scope | contextual component, not permanent by default |
| persistent | reservation skill | Spirit cost, weapon-set availability, active roster | roster must remain feasible after replacement |

## Support compatibility failure fixtures

- A support tag match is insufficient when the support modifies only one component of a multi-component skill.
- Additional projectiles do not imply all projectiles hit one boss.
- Trigger supports require Energy, cooldown, reservation and sustain coverage.
- A minion support cannot apply player-only stats without explicit wording.
- A totem is not a minion and needs its own inheritance rules.
- Gem-level increases must re-evaluate cost and attribute requirements.
- Ailment supports require explicit chance/application and known stacking behaviour.
- Persistent supports must keep the complete Spirit roster feasible in the active weapon set.

## Item value dimensions

Every archetype comparison must keep these values separate: current power, breakpoint value, build-enabling value, transition-package value, future crafting option value, and observed market popularity. Only the first four may influence a build recommendation, and only when their mechanics are covered. Popularity is metadata.

