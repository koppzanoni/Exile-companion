# POE2 itemization research

Updated: 2026-07-14

## Purpose

This document separates game mechanics, observed build practice and subjective meta opinion before any rule reaches the item analyzer.

## Evidence classes

1. `official`: GGG patch notes, announcements and API data. May define mechanics and patch compatibility.
2. `mechanics-reference`: PoE2 Wiki/PoE2DB modifier and item tables. May define affix domains, local/global behavior and spawn restrictions after validation.
3. `creator-build`: patch-labelled guides from established creators. May define one build variant's priorities, breakpoints and progression stages.
4. `population-observation`: poe.ninja character samples. May describe prevalence, never causation or an automatically optimal choice.
5. `community`: Reddit questions and answers. Useful for failure modes and hypotheses; never activated as a scoring fact without corroboration.

## Confirmed mechanics that affect scoring

- Rare equipment normally has three prefixes and three suffixes; magic equipment has one of each. Open affixes therefore have option value, but not a guaranteed craft outcome.
- Local and global modifiers must be distinguished. Local weapon damage, local attack speed and local critical chance change the weapon base; local armour/evasion/energy-shield modifiers change the item's displayed defence.
- Conditional modifiers are global. A textual percentage cannot be scored correctly without its scope and condition.
- Resistance is a character-state constraint: value is high below the target, falls near/above the target, and can become swap-critical when concentrated on one slot.
- Attribute and Spirit values are breakpoint-driven. Their marginal value changes after requirements/reservations are satisfied.
- Item level, base type, affix domain, affix count, sockets/runes, corruption and desecration affect current power and future option value separately.

## Build-dependent rules

- Score against a named build variant and stage, not only class/ascendancy. Early, non-crit, hybrid, crit and aspirational variants can value the same item differently.
- Weapons need a build-specific effective-DPS model: local base damage, attack/cast speed, damage types, conversion, critical state, skill levels and conditional uptime.
- Armour bases need defence-style compatibility. Raw armour, evasion and energy shield are not interchangeable when passives or ascendancy mechanics scale one layer.
- Required uniques and enabling modifiers are constraints, not ordinary weighted stats.
- Gem/support attribute requirements, Spirit reservations and weapon-set assignments are part of item fit.
- Content target matters: mapping, bossing, hardcore and speed leveling have different risk, mobility and single-target priorities.

## Observed 0.5 examples

- Fubgun's Ice Shot Deadeye guide explicitly changes variants across early, non-crit, hybrid and crit stages. It prioritizes elemental resistances to 75%, some chaos resistance, targeted attribute rolls, flat attack damage on rings/gloves and the highest appropriate bow DPS.
- Community reports show that a more expensive or higher-tooltip-DPS bow can reduce real build DPS. This is evidence that price and raw DPS cannot replace build simulation.
- Current community advice repeatedly treats elemental resistance caps as a constraint, while life/ES/armour/evasion and damage scaling remain build-specific optimization dimensions.
- Spirit sources and reservation efficiency are slot/domain-specific; the analyzer must know whether Spirit is actually required before valuing it highly.

## Current scope and class taxonomy

The active research scope is Early Access patch `0.5.x` (Return of the Ancients). The current roster has eight base classes. A base class is only a routing hint; the analyzer must not create a combat score from class popularity.

| Base class | Attribute/identity tendency | Current ascendancy families | Itemization branches that must remain separate |
| --- | --- | --- | --- |
| Warrior | Strength, melee, slams, shields | Titan, Warbringer, Smith of Kitava | two-handed hit, armour break, warcry/slam, shield/block, totem, forged-equipment interactions |
| Ranger | Dexterity, bows, projectiles | Deadeye, Pathfinder | elemental bow hit, physical/conversion bow, poison, critical and non-critical variants |
| Witch | Intelligence, occult/minions | Infernalist, Blood Mage, Lich | persistent minions, temporary minions, chaos DoT, spell hit/crit, life-cost and ES variants |
| Sorceress | Intelligence, elemental spells | Stormweaver, Chronomancer | mana caster, crit trigger, elemental hit, freeze/control, support/party specialization |
| Mercenary | Strength/Dexterity, crossbows/grenades | Witchhunter, Gemling Legionnaire, Tactician | crossbow hit, grenades, ailment/elemental, gem-quality/level scaling, party/control |
| Monk | Dexterity/Intelligence, quarterstaves | Invoker, Acolyte of Chayula, Martial Artist | elemental attack, physical/crit attack, power-charge engines, chaos/mana interactions, unarmed or stance-specific setups |
| Huntress | Dexterity, spears, mobility/companions | Amazon, Ritualist, Spirit Walker | spear hit, projectile/melee hybrid, companion/Spirit, ritual/corpse or unique-heavy setups |
| Druid | Strength/Intelligence, shapeshifting/nature | Shaman, Oracle | form attacks, spell/form hybrid, elemental/nature caster, Runic Ward and prophecy/utility interactions |

This table is deliberately broad. Each branch needs its own sourced build profile before it can affect a production score.

## Archetype dependency model

The analyzer must first classify how the skill actually deals damage. Tags alone are insufficient.

| Archetype | Primary item questions | Common false-positive |
| --- | --- | --- |
| Attack hit | Is damage local to the weapon? Which damage types survive conversion? Does attack speed improve the real rotation? Is accuracy relevant? | Treating a larger tooltip or elemental roll as universally better |
| Spell hit | Do gem levels, cast speed, crit, mana cost and added damage scale this spell at the current stage? | Awarding weapon physical DPS to a spell that does not use it |
| Damage over time | Which modifiers affect the DoT and its source? Does hit/crit only enable an ailment or actually scale damage? | Scoring hit damage or critical multiplier as full DoT value |
| Trigger/meta gem | Are trigger threshold, Spirit, reservation, hit frequency, cooldown and mana sustainable? | Recommending the trigger package before its breakpoints are met |
| Persistent minion | Does the modifier explicitly affect minions/allies? How much Spirit does the composition reserve? | Applying player offence to minions or valuing Spirit after the roster is already satisfied |
| Temporary minion | Is scaling from gem level, duration, creation rate or a command skill? | Treating it like a permanent Spirit-reserved minion |
| Totem | Which player stats are inherited, and which totem-specific stats control uptime? | Assuming every player attack/cast modifier transfers |
| Companion | Is the one-companion constraint changed? Is this a damage, utility or defensive companion? | Counting companion stats without checking the active limit |
| Conversion/hybrid | What is the ordered conversion chain and which source modifiers apply before/after conversion? | Double counting the same damage across source and destination types |
| Party/support | Is solo damage intentionally sacrificed for rarity, cull, curses or control? | Labelling a specialized support item as a severe solo-build error without role context |

## Constraint-first evaluation order

An item is not accurately scored by one weighted sum. It passes through ordered gates:

1. **Legality:** slot, level, attribute and weapon requirements; corruption/socket restrictions.
2. **Build enablement:** required unique, modifier, weapon type, gem level, skill slot, Spirit or reservation breakpoint.
3. **Post-swap viability:** remove the equipped item first, then recalculate resistances, attributes, Spirit, skill activation and defensive dependencies.
4. **Primary scaling:** use the build's damage/defence model, never generic DPS.
5. **Quality:** affix tiers, roll ranges, base quality, sockets/augments and compatible local/global scopes.
6. **Option value:** open affixes and crafting routes, reported separately from current power.
7. **Economics:** verified listings, liquidity and replacement cost; price never changes combat power.
8. **Confidence:** reduce or withhold the verdict when parser, build profile, patch or character state is incomplete.

A failed hard constraint produces `incompatible` or `unsafe swap`, not merely a lower score. A soft target produces a marginal value curve rather than a binary penalty.

## Slot calculus

- **Main/off-hand:** identify attacks versus spells, local versus global modifiers, weapon-set assignment, granted skills/Spirit and shield/block dependencies. Effective weapon damage must be calculated per skill and conversion state.
- **Body armour:** base defence compatibility and large defensive prefixes usually dominate, but build-enabling uniques and socket/augment effects can override generic value.
- **Helmet, gloves and boots:** preserve attribute/resistance dependencies; separately model skill levels, attack/cast speed and build-specific implicits. Movement speed is a gameplay and survival dimension on boots, not generic tooltip DPS.
- **Rings and amulet:** treat resistance, attributes, flat attack damage, gem/skill levels, mana and reservation as breakpoint-sensitive. Anoints and special base implicits require explicit parsing.
- **Belt:** evaluate flask/charm interactions, attributes, life/defence and unique-enabling effects. Charm capacity and charge economy must not be reduced to raw life.
- **Jewels:** evaluate only against reachable sockets and affected passive radius/domain; do not score an isolated jewel as equipped power without placement.
- **Charms:** match ailment/threat coverage, charges and content target. Duplicate protection can have near-zero marginal value.
- **Runes/augments:** record socket compatibility, bonded/corrupted state and replacement rules. A socket is option value; a hypothetical perfect augment is not current power.

## Defensive state model

- Elemental resistance targets are hard survivability constraints in most endgame profiles, but overcap value depends on curses, exposure and the target content. Chaos resistance policy is profile-specific.
- Armour, evasion and energy shield are distinct layers. Since patch 0.5, the game wording explicitly excludes Runic Ward, resistance and block from the collective armour/evasion/ES concept.
- Runic Ward is not energy shield: damage reaches life first and Ward behaves as a reverse outer reserve. It needs a separate survival model.
- Deflection, block, avoidance, recovery, stun threshold, ailments and maximum-hit protection cannot be collapsed into a single additive `defence` stat.
- Average EHP is insufficient by itself. Report at least expected mitigation, physical/elemental/chaos maximum-hit proxies, recovery sustainability and conditional uptime when the data exists.
- Hardcore, bossing and mapping profiles assign different loss functions. The analyzer must show that choice instead of silently applying a universal risk tolerance.

## Progression and transition awareness

Build guides commonly contain several internally consistent loadouts. The analyzer must identify the closest stage before recommending an upgrade:

1. campaign/leveling;
2. early maps with requirement and resistance repair;
3. established non-critical or starter engine;
4. transition loadout, where all enabling breakpoints must be purchased together;
5. mature endgame;
6. aspirational/mirror-tier optimization.

Transition detection is essential. A crit weapon without enough total crit investment, or a trigger gem without sufficient Spirit and sustain, can make a character worse even if the item belongs to the final build. Recommendations should support bundles/scenarios rather than forcing every change into a one-item comparison.

## Population and expert evidence

- poe.ninja is useful for distributions and co-occurrence: which items, skills and passives appear together for a filtered population.
- It cannot establish causation, affordability, survivorship, comfort, or whether a character is configured for mapping, bossing, party play or display.
- Creator guides add intent and progression context. Patch label, update date, variant and written caveats must be stored. A video title or popularity count is not evidence of numerical superiority.
- Reddit is especially valuable for counterexamples: failed crit transitions, missing attributes, uncapped resistance and expensive weapons that lower real DPS. Such reports create regression cases, not production weights.
- Conflicts remain visible. The system should say “sources disagree” rather than average incompatible builds.

## Research-to-production confidence rubric

| Confidence | Minimum evidence | Allowed product behavior |
| --- | --- | --- |
| Confirmed | patch-compatible game/API data or validated mechanics table | deterministic rule with source/version |
| Strong | confirmed mechanic plus two compatible build sources or outcome tests | recommendation with explicit assumptions |
| Moderate | one maintained build profile plus mechanically valid reasoning | suggestion/scenario, never a hard failure |
| Experimental | population pattern or corroborated community hypothesis | informational insight only |
| Unknown | missing patch/profile/parser/state | no score claim; request missing context |

## Concrete implementation schema

Each rule should be addressable as data rather than buried in prose:

```text
BuildProfile {
  patch, league, class, ascendancy, role, contentTarget,
  mainSkills[], variant, progressionStage,
  damageModel, conversionChain[], critState,
  requiredEnablers[], forbiddenConflicts[], transitionBundles[],
  reservationPlan, attributeRequirements, resistancePolicy,
  defenceLayers[], recoveryModel,
  slotPolicies{}, sources[], confidence, limitations[]
}
```

The next implementation should add: modifier scope/domain parsing; build-profile versioning; transition bundles; skill-aware weapon calculations; minion/totem inheritance; distinct Runic Ward/deflection models; and calibration fixtures built from before/after character snapshots. No learned weight should be promoted without out-of-sample regression tests.

## Patch 0.5 class and ascendancy coverage matrix

This matrix covers every currently documented base-class ascendancy family. “Observed archetype” means a maintained 0.5 build or mechanics reference was inspected; it does not mean the archetype is uniquely optimal.

| Class / ascendancy | Observed 0.5 archetypes | Itemization facts the analyzer must model | Coverage status |
| --- | --- | --- | --- |
| Warrior / Titan | slams, aftershocks, heavy stun, strength/life, armour | weapon hit model, attack time, stun buildup, rage/Glory, body-armour defence and maximum-life scaling | mechanics + maintained guide |
| Warrior / Warbringer | warcries, armour break, shield/block, totems/ancestral spirits | shield state, block loss, armour-break application/uptime, totem cap and inherited stats | mechanics + community counterexamples |
| Warrior / Smith of Kitava | fire-on-hit, forged/manifest weapon, normal-body-armour Masterwork | normal-body-armour constraint, chosen Masterwork properties, fire-resistance cross-scaling, minion/weapon split | confirmed mechanics |
| Ranger / Deadeye | Ice Shot, Lightning Arrow, elemental bow, crit/non-crit transitions | effective bow DPS after conversion, projectile count/behavior, flat attack damage, accuracy, crit bundle | multiple maintained guides |
| Ranger / Pathfinder | poison, gas grenade, flask/charge engines, CoC mana variants | ailment magnitude/stacking, flask uptime, charge sustain, hit-versus-DoT separation | maintained guides; profile-specific |
| Witch / Infernalist | Demon Form caster, ignite, Infernal Flame, Hellhound, life-reservation contracts | life degeneration sustain, maximum-life tradeoffs, reserved life, Spirit/ES/mana derived from life, ignite source | confirmed mechanics + guides |
| Witch / Blood Mage | crit spells, bleed conversion, life-cost caster | simultaneous mana/life cost, overflow/recovery, crit state, body-armour item ES converted into maximum life | confirmed mechanics + maintained guide |
| Witch / Lich | chaos DoT, curses, ED/Contagion, minions | DoT versus hit modifiers, curse limits/effect, chaos scaling, minion/player stat separation | maintained progression guide |
| Witch / Abyssal Lich | alternate ascendancy context | must be tagged as alternate acquisition and never silently treated as ordinary Lich | mechanics coverage; build corpus still thin |
| Sorceress / Stormweaver | Spark/Arc, elemental ailments, CoC Comet, mana defence | mana sustain, Spirit/trigger energy, cast speed, crit, ailment contribution, freeze/shock uptime | multiple maintained guides/videos |
| Sorceress / Chronomancer | cooldown/reset, delayed damage, Comet, party rarity/cull | cooldown breakpoints, repeat/reset value, delayed-damage recovery, solo versus party role | mechanics + maintained guides |
| Sorceress / Disciple of Varashta | Djinn commands, plants, Comet, staff+focus | command cooldown/cast speed, minion levels, staff/focus penalty, mana-before-life and ES/armour interactions | mechanics + multiple 0.5 guides |
| Mercenary / Witchhunter | explosive crossbow/grenades, armour/evasion | crossbow local DPS/reload/skill compatibility, grenade cooldowns, leech/sustain, preserve armour/evasion bases | maintained staged guide |
| Mercenary / Gemling Legionnaire | gem quality/levels, grenades, Bitter Dead, slam variants | alternate quality, skill slots, attribute requirements, corpse-consumption and Spirit hard breakpoints | multiple maintained guides |
| Mercenary / Tactician | leveling, banners/pin, support and Spirit-oriented variants | Spirit granted/enabled by ascendancy, pin/control uptime, party role versus solo damage | maintained leveling evidence; endgame corpus thinner |
| Monk / Invoker | Ice Strike, elemental crit, heralds, bell | staff/unarmed state, elemental conversion, power charges, bell rotation, evasion+ES defence | maintained guide |
| Monk / Acolyte of Chayula | chaos/extra damage, Strength trigger/tornado, volatility | darkness/chaos engine, unique weapon trigger, Strength breakpoint, block alternative | maintained 0.5 guide |
| Monk / Martial Artist | Hollow Palm, Whirling Assault, Trinity, crit/bell | empty-main-hand constraint, gloves as enhanced slot, evasion/ES offensive conversion, charge/Trinity uptime | several maintained guides/videos |
| Huntress / Amazon | spear/projectile, lightning/crit, bossing | spear local DPS, melee/projectile portions, accuracy/crit state, rage and weapon requirements | maintained guide; more corroboration needed |
| Huntress / Ritualist | jewelry amplification, frenzy/glacial lance, unique-heavy setups | additional ring/effective jewelry scaling, charge generation, required-unique bundle | maintained guide |
| Huntress / Spirit Walker | Twister, companions/beast master, Spirit stacking | companion limit, reservation, beast modifiers, spear/mobility engine, Spirit opportunity cost | several maintained guides/videos |
| Druid / Shaman | bear attacks, rage, Walking Calamity, spell totems | form/weapon applicability, rage and Glory generation, attack versus spell scaling, totem inheritance | multiple maintained guides |
| Druid / Oracle | plant caster, crit trigger, frost wolf/hybrid | Forced Outcome crit behavior, exact gem level to control mana, weapon-set casting, ES/chaos-resistance dependency | multiple maintained guides/videos |

### Cross-class findings from the video-linked guide corpus

- **A build stage is part of the build.** Fubgun, Ronarray, Big Ducks, Raxx and other maintained guides expose separate campaign, early-map, transition and endgame loadouts. Comparing an early character directly with the final loadout creates false upgrades.
- **Skill level can have a maximum useful target.** Raxx's Oracle guide deliberately keeps a triggered Thunderstorm at a specific final level to reduce mana cost while retaining its purpose. “More gem levels” is therefore not universally positive.
- **An ascendancy may change the best item base.** Hollow Palm Martial Artist converts armour-slot evasion/ES choices into offence; Smith of Kitava can impose a Normal body-armour constraint; Blood Mage values item Energy Shield on body armour through a life conversion.
- **Some builds have near-binary breakpoints.** Bitter Dead Gemling reports a very high chance-to-not-consume-corpses threshold before the engine feels functional. Trigger and companion builds similarly require complete Spirit/reservation packages.
- **Weapon sets are functional loadouts.** Oracle and Disciple examples use a second staff for Sigil of Power or assign spells to a specific stronger weapon set. An off-set item cannot be scored as permanently active.
- **Defensive substitutions have semantic cost.** A Witchhunter guide warns that a particular ward-oriented replacement can remove the armour/evasion base the build relies on. A generic “more new defence” score would recommend a regression.
- **Role must be explicit.** Chronomancer rarity/cull and some Tactician/party configurations intentionally sacrifice solo output. They must be compared with the same role.

### Video evidence protocol

For every imported creator claim, store:

- video URL/channel/title/publication or update date;
- patch, league, class, ascendancy, variant and stated budget;
- whether evidence came from spoken explanation, on-screen gear/tree, written companion guide or gameplay only;
- exact breakpoint or recommendation and its stated reason;
- mechanic corroboration status;
- conflicts with other variants;
- last revalidation date.

The research must never mark a video “reviewed” merely because its description or companion page was indexed. The current batch inspected video-linked written guides and their explicit explanations; full timestamped transcription remains a separate evidence task.

## Crafting and future-value model

Current power and crafting potential must be separate result dimensions. The following patch-current mechanics materially affect that separation:

- Item level gates eligible affixes and tiers. A high item level is potential, not combat power.
- Quality is applied as a distinct multiplier after other relevant modifiers. On martial weapons it improves physical damage, not every added elemental component; on armour it improves the local armour/evasion/energy-shield values. Wands, staves and sceptres instead pass quality to their inherent skill where applicable.
- Jewellery catalysts are typed. Changing catalyst type replaces the prior quality effect, so “20% quality” is incomplete without its catalyst domain.
- Exceptional bases may exceed normal quality or socket limits. Exceptional quality, an exceptional socket and a corruption socket can represent different sources and may stack within the grid-space limit.
- Augment sockets are not ordinary affixes. Socketed augments can normally be replaced only by destroying the previous augment; extraction may destroy the equipment. The analyzer must price current augment, empty socket and replacement risk independently.
- Some endgame runes are limited to one per character. Equipping duplicates can disable items/runes, so rune value requires the complete character state.
- Rune behavior may include a Bonded effect that is only active when an enabling source exists. The parser must never award the Bonded line unconditionally.
- Corruption is irreversible and normally closes further conventional crafting. It may reroll modifiers, add an enchantment or add a socket. A corrupted item can be stronger now while having lower future option value.
- Essences now have tier-specific fixed outcomes. Lesser/normal/greater essences promote a magic item and add a guaranteed modifier; perfect/corrupted essences replace a random rare modifier with a guaranteed modifier. “Use an essence” is therefore not a deterministic upgrade unless the removed-mod risk is represented.
- Desecration offers a choice of revealed modifiers, with exclusive pools depending on item class. It is neither a generic free affix nor safe to simulate without the exact pool, weights and omen state.
- Open affixes, sockets and unrevealed choices should produce a scenario range: current floor, supported outcomes and unknown tail. The product must not add the expected value of an ideal craft directly to combat score.

### Required crafting output

For every item, report independently:

1. current equipped power;
2. legal remaining operations;
3. irreversible state and replacement risks;
4. known guaranteed outcomes;
5. random outcome space when versioned pools exist;
6. currency inputs known from the selected route;
7. missing prices or unknown probabilities;
8. best-case potential as a labelled scenario, never as the item score.

## Thin-profile follow-up findings

### Amazon

- Current maintained 0.5 material supports at least Lightning Spear and crit/non-crit progression variants.
- Spear evaluation must separate the melee strike, projectile behavior and any secondary/projectile effects rather than reuse bow DPS.
- Accuracy can be an offensive scaling input in Amazon-specific configurations, but the exact conversion belongs to the selected ascendancy/passive profile; it is not a universal Amazon rule.
- Required evidence before strong scoring: a second maintained 0.5 source, exact current ascendancy nodes, skill-specific hit model and confirmed before/after character fixtures.

### Tactician

- Maintained 0.5 evidence now includes Pin/grenade and crossbow leveling-to-endgame routes, not only speculative community discussion.
- Tactician value can be concentrated in Spirit efficiency, Pin/control and support mechanics. These dimensions are not captured by raw crossbow DPS.
- Pin has content-dependent value and must not be treated as equivalent damage against every target. Grenade cooldown/reload and ailment/control rotations need encounter-aware uptime.
- Required evidence before strong scoring: exact Pin thresholds/boss behavior, banner/support inheritance, two endgame loadouts and a role label for solo versus party.

### Abyssal Lich

- Abyssal Lich is an alternate Lich ascendancy acquired through endgame content, so availability must be checked rather than inferred from class.
- Current 0.5 maintained evidence includes Plant/Abyssal Lich and chaos/physical spell directions. Community usage alone is not enough to declare either optimal.
- Eldritch Empowerment sacrifices a percentage of maximum Energy Shield when casting a spell. Cast frequency, ES recovery and bypass/damage-reduction layers therefore form one coupled sustain model.
- High ES is not automatically safe: the analyzer must simulate the cost cadence and recovery, and distinguish maximum hit from sustained casting survivability.
- Required evidence before strong scoring: full current node data, acquisition state, spell-frequency fixtures and an independent maintained profile beyond the Plant build.

## Anti-pattern library for regression tests

The following recommendations should be treated as known failure classes:

- “Higher weapon DPS is always better.”
- “More gem levels are always better.”
- “An empty affix equals the best possible crafted modifier.”
- “Corrupted and uncorrupted copies have equal future value.”
- “All quality improves all damage on a weapon.”
- “Spirit is valuable even after the exact active reservation plan is satisfied.”
- “All player damage modifiers affect minions, companions or totems.”
- “An offhand/weapon-set modifier is permanently active.”
- “Runic Ward, ES, armour, evasion, deflection and block are additive copies of EHP.”
- “A popular poe.ninja item is a causal upgrade.”
- “A final-build item is individually good before the transition bundle is complete.”
- “A duplicate limited rune remains active.”
- “Bonded rune text is active without its enabler.”
- “A random essence replacement is guaranteed to preserve the valuable modifier.”

## Defensive and ailment calculation findings

### Armour and maximum hit

- Armour mitigation depends on the size of each incoming hit. It is substantially stronger against small repeated physical hits than a single large hit.
- The base physical-hit reduction can be represented as `A / (A + 10 * D)`, where `A` is applicable armour and `D` is the incoming damage used by the calculation, subject to the relevant cap.
- Consequently, the UI must not display one context-free “physical reduction from armour” number. It should show mitigation at selectable representative hit sizes and a source for those scenarios.
- Armour normally does not mitigate damage over time. “Armour applies to elemental/chaos damage” must be modelled as an explicit scoped modifier and calculated independently per damage component.
- Maximum hit and average mitigation are distinct. More armour can improve mapping smoothness without proportionally improving survival against a pinnacle slam.

### Evasion and Deflection

- Evasion avoids eligible hits; Deflection mitigates a portion of hits that occur. They are sequentially different outcomes, not additive percentages.
- Patch 0.5 uses a new accuracy-versus-Deflection formula and caps Deflection chance at 95%. By default, a deflected hit prevents 40% of its damage.
- Deflection can work against red-flash boss attacks where Evasion does not provide the same protection. This makes content target mandatory when comparing the two layers.
- Both depend on attacker Accuracy. A character sheet estimate without an attacker/reference level must be labelled as an estimate.

### Energy Shield and Runic Ward

- ES takes mitigated damage before life, but chaos removes twice the corresponding ES amount. Bleeding and poison bypass ES to life by default.
- Base ES recharge begins after four seconds without losing life or ES and recovers 12.5% of maximum ES per second. Faster-start modifiers use a reciprocal delay curve rather than subtracting seconds linearly.
- Recharge, regeneration, recoup, leech and instant recovery are separate mechanics and must remain separate in sustain analysis.
- Runic Ward follows a different damage order and regeneration model. ES-based recommendations cannot be copied to a Runic Ward build.

### Resistances, Exposure and Penetration

- Resistance caps and maximum resistances are separate values. Overcap can protect against reductions but does not raise the active maximum without an explicit maximum-resistance modifier.
- Exposure and resistance-reducing curses can lower an enemy below zero and can stack where allowed.
- Penetration is evaluated for hits after other resistance changes and, by default, cannot penetrate below zero. It does not improve damaging ailments directly.
- Therefore a build already reducing the target below zero may receive no hit benefit from additional penetration, while exposure/curse uptime can still matter for ailments.

### Damage conversion

- PoE2 conversion differs from PoE1: converted damage retains only the final damage type for scaling; there is no inherited source-type scaling chain.
- Regular conversion removes source damage, while “gain as extra” preserves it. Both are applied before increased/more damage modifiers, with skill-inherent conversion handled before other sources.
- Overconversion is normalized. The analyzer must not add percentages beyond 100% independently or double count source and destination damage.
- Weapon scoring therefore requires the exact skill conversion and the final damage types, not a generic sum of all weapon DPS components.

### Damaging ailments

- Ignite is derived from the fire portion of the creating hit before mitigation/damage-taken modifiers, deals its magnitude over its duration and does not stack by default; only the strongest active ignite deals damage.
- Poison derives from physical plus chaos damage of the creating hit, requires an explicit application chance, bypasses ES and has a build-dependent stack limit. Attack speed has different value before and after poison application/stack/sustain constraints.
- Penetration is a hit-only stat and must not be awarded as direct poison/ignite DPS.
- Damaging ailments are primarily scaled through their source hit, ailment magnitude, duration/stack behavior and enemy mitigation. Generic “increased damage” text needs domain validation.

### Non-damaging ailments and control

- Shock chance depends on post-mitigation lightning contribution relative to ailment threshold; crit does not guarantee shock. Default Shock increases damage taken, with magnitude and stacking exceptions requiring explicit sources.
- Chill below its minimum magnitude is discarded. Rare/unique enemies reduce slow effect, so a mapping chill result cannot be copied to pinnacle bosses.
- Freeze buildup/control, Pin, stun and similar immobilization effects require poise/threshold and target-rarity context. Tooltip damage alone cannot prove uptime.
- Armour Break has duration and a Fully Broken state. Fully Broken Armour changes physical-hit damage, and Warbringer can introduce negative-armour behavior. Extra break after the state is reached may have low or specialized marginal value.

### Required defensive report

The analyzer should eventually return:

1. raw pools: life, ES, mana-protection and Runic Ward;
2. resistances, maximums and overcaps by type;
3. armour mitigation at multiple hit sizes;
4. evade/deflect/block probabilities with the assumed attacker;
5. physical, elemental and chaos maximum-hit scenarios;
6. DoT exposure, especially bleed/poison bypass;
7. recovery by mechanism and expected downtime;
8. stun/ailment/control thresholds;
9. conditional layer uptime;
10. unknown inputs and confidence.

## Implementable offensive pipelines

These pipelines define inputs and evaluation order. They are intentionally not universal closed-form DPS promises: skill geometry, enemy count and uptime may remain scenario inputs.

### Weapon attack pipeline

Required inputs:

- active weapon set and compatible hand(s);
- weapon local physical/elemental damage ranges, attacks per second and local critical chance;
- skill level, attack-damage multiplier, attack-speed multiplier and fixed/total use-time modifiers;
- accuracy and assumed target evasion/distance where applicable;
- added base damage, skill-inherent conversion, external conversion and gain-as-extra;
- applicable increased/more modifiers after final damage types are known;
- critical chance/bonus, double-damage-like outcomes and target mitigation;
- projectile/area/strike hit rules and realistic number of hits per use;
- resource cost, cooldown, rotation uptime and conditional buffs.

Evaluation order:

1. select compatible weapon/hand behavior;
2. construct local weapon base and add skill/player base damage;
3. apply skill-inherent then external conversion/gain rules;
4. apply final-type/global increased and more modifiers;
5. apply hit chance and crit expectation only for eligible attacks;
6. apply skill hit multiplicity without assuming simultaneous projectile shotgun;
7. apply target mitigation/debuff scenario;
8. divide by real cycle time, including fixed use time, cooldown, movement or reload where relevant.

Dual wielding requires skill-specific handling. It grants no inherent generic bonus; a skill may alternate hands or combine separately rolled hands. An incompatible offhand may be ignored rather than averaged.

### Bow and spear specialization

- Simultaneously fired projectiles normally cannot all hit the same target unless the skill explicitly allows it. Sequential projectiles can.
- Additional projectiles can be clear-speed or coverage value without being single-target multipliers.
- Bow/spear skills with explosions, shards, returns or secondary effects require an explicit overlap model; absent geometry evidence, return a range or unknown multiplicity.
- Spear skills may contain distinct melee, projectile and payoff components. Each component keeps its own damage effectiveness and conditional state.

### Crossbow specialization

- Sustained rate is a clip cycle, not displayed weapon APS alone: firing time, bolts per reload, reload time, immediate-reload chance, ammunition preservation and manual swaps all matter.
- Ammunition cost is generally paid on reload. Mana sustainability must be calculated per reload/cycle.
- Crossbow projectile rules can differ from the generic simultaneous-projectile rule; multiple projectiles from a crossbow skill may hit the same target, and additional single-projectile shots may fire sequentially.
- Grenades require fuse/cooldown/projectile/overlap modelling separately from ammunition bolts.
- Emergency Reload and empowered clips are burst windows. Report burst and sustained damage separately.

### Spell-hit pipeline

- Spell base damage, cast time and base critical chance come from the skill, not the martial weapon.
- Gem level changes base values, requirements and cost; it must be evaluated together with mana/life/ES sustainability.
- Wands, staves, sceptres, focus items and granted skills contribute only through applicable global/granted modifiers.
- Cast speed improves throughput only when casts, cooldown, trigger cadence or resource recovery are not the binding constraint.
- Projectile overlap, chaining, repeats and area hits require the same explicit geometry policy used for attacks.

### Damaging-ailment pipeline

1. calculate the eligible source hit before target mitigation/damage-taken modifiers;
2. determine explicit application chance or threshold mechanics;
3. derive ailment base magnitude from eligible damage types;
4. apply ailment magnitude and duration/stack-limit rules;
5. apply enemy resistance and damage-taken effects that actually affect the ailment;
6. calculate application rate and sustainable active stacks/strongest instance;
7. keep hit DPS and ailment DPS separate before presenting a combined scenario.

This prevents hit-only penetration, crit or attack speed from receiving invalid full DoT value.

### Minion and companion pipeline

- Player offence/defence does not apply unless wording explicitly targets minions or allies.
- Attack minions currently always hit, so player/minion accuracy should not inflate their damage.
- Skill level controls minion base stats and can include non-unique-monster scaling; mapping and unique-boss results must remain separate.
- Persistent composition is constrained by Spirit, reservation efficiency, companion limits and weapon-set resource changes.
- Real output requires active count, attack/cast cadence, command cooldown, AI/contact uptime, revive downtime and target type.
- A weapon swap that lowers available Spirit can remove minions; the comparison must simulate resulting roster changes.

### Totem pipeline

- Totems are allies but not minions. Their skills use applicable player offensive stats while their defensive state, placement and uptime are their own.
- Shared totem limit, placement time, emergence delay, survivability and replacement frequency are part of sustained output.
- Ballista/attack totems still require the underlying weapon/attack model.
- Tactician's conditional firing behavior, Warbringer's damage redirection and Oracle's delayed-death behavior change uptime and defensive value; none is a generic damage multiplier.

### Trigger/meta pipeline

- Every meta gem has independent Energy. Energy overflow can be discarded when the counter resets.
- Multiple socketed triggered skills combine their Energy requirement and trigger together.
- Triggered skills occur without their normal attack/cast time, but Energy requirements can depend on base use time. Total-use-time modifiers receive special Energy treatment.
- Triggered effects do not count as using a skill, and direct effects of triggered skills normally cannot generate Energy.
- Two trigger methods targeting the same skill can disable it; channelled skills cannot normally be triggered.
- Cast on Critical requires Spirit, actual crit events, target Power/threshold contribution, socketed base cast time, Energy gain and its own less-damage modifier.
- Trigger analysis must report enabling threshold, triggers per second, cost per trigger, sustained resource balance and wasted Energy. Tooltip spell DPS alone is insufficient.

## Engine data contracts derived from research

The implementation should introduce versioned records equivalent to:

```text
SkillMechanicProfile {
  patch, skillId, level, tags, weaponRequirements,
  components[], baseDamage, effectiveness, useTime,
  cooldown, cost, conversion[], gainAsExtra[],
  projectileRules, overlapPolicy, ailmentRules,
  triggerRules, qualityEffects[], sources[], confidence
}

RotationScenario {
  contentTarget, targetRarity, targetCount, distance,
  durationSeconds, movementShare, buffUptimes,
  debuffUptimes, assumedEnemyDefences,
  resourceRecovery, minionContactUptime,
  uncertainty
}

OffenceResult {
  legality, activeComponents, ailmentDps,
  burstDps, sustainedDps, clearCoverage,
  resourceBalance, breakpointFailures,
  assumptions, missingInputs, sources, confidence
}
```

No item comparison should expose a precise DPS delta unless the selected skill profile covers every materially relevant component. Otherwise it should return stat deltas, supported directional effects and the missing inputs.

## Mapping onto the current backend

The repository already contains useful foundations that should be extended rather than replaced:

- `BuildFitProfile` holds class, ascendancy, main skill, stage, weapon types, damage types, priorities, requirements, Spirit, resistance policy and dependencies.
- `statValuationEngine` applies character-state breakpoints and replacement-aware weights.
- `buildFitScoring` provides category/priority fit and parser-confidence warnings.
- versioned `skill_profiles`, modifier definitions/groups and catalog-version tables already exist in the database.
- the crafting state machine already preserves unknown random affixes rather than inventing a result.

Current limitations revealed by the research:

- Two scoring paths currently overlap: `buildFitScoring.statStrength` and `statValuationEngine` both independently interpret offensive/defensive stats. New mechanics must not be implemented twice.
- `BuildFitProfile.conversions` is a string map and cannot represent ordered skill-inherent/external conversion, gain-as-extra or component-specific conversion.
- The present stage enum has campaign, early maps and endgame only; it cannot distinguish transition and aspirational states.
- Physical/elemental weapon DPS is currently valued by generic damage tags and fixed diminishing targets. It cannot safely produce build DPS for conversion, ailments, crossbow cycles, Hollow Palm or spell builds.
- Local defensive values use fixed per-item targets. They do not yet feed hit-size mitigation, maximum-hit or build-specific base interactions.
- Crit recognition combines several textual concepts and does not fully distinguish local base crit, increased chance, critical damage bonus and guaranteed-crit mechanics.
- Spirit is treated as a numeric requirement but not yet as a full reservation roster with weapon-set differences.
- Existing generic profiles remain valuable as directional fit fallbacks but must be prevented from emitting precise outcome claims.

### Smallest safe implementation slice

1. Extend the versioned `skill_profiles` payload rather than expanding hard-coded build score branches.
2. Add a single `mechanicCoverage` result describing covered components and blockers.
3. Route exact offence computation through one new pure evaluator used by both Analyzer and Build Doctor.
4. Keep `statValuationEngine` as the state/breakpoint and directional fallback layer.
5. Gradually make `buildFitScoring` consume normalized contributions instead of parsing the same stats again.
6. First profile one simple attack, one spell and one crossbow skill; prove unknown/partial behavior before broadening coverage.
7. Store formula/source/version/confidence beside every profile and reject patch mismatch.

This migration keeps existing API consumers working while replacing generic claims incrementally. It avoids a large rewrite and provides an explicit fallback whenever exact coverage is incomplete.

## Meta policy

- Meta data must be patch-, league-, class-, ascendancy-, skill-, stage- and content-labelled.
- Popularity is not power. It may affect liquidity and comparable availability, but cannot directly increase combat score.
- Creator claims and tier lists need source, update time and confidence. Conflicting sources remain separate.
- Without an active validated catalog, meta status is `unknown`; build-specific deterministic analysis continues normally.

## Analyzer model to implement

Each build variant should provide:

- patch and data version;
- class, ascendancy, main skill and variant/stage;
- required uniques/modifiers and forbidden conflicts;
- skill/support attribute requirements;
- Spirit reservation target;
- resistance targets, including chaos target policy;
- damage source, conversion chain, critical state and weapon formula;
- defensive layers and compatible base families;
- per-slot required, high and useful affixes;
- minimum breakpoints and diminishing-return targets;
- mapping/bossing/hardcore/leveling priorities;
- source list, confidence and limitations.

The item result should separately report:

1. legality and usability;
2. requirement coverage;
3. defensive impact after swap;
4. offensive impact after swap;
5. build-enabling compatibility;
6. affix quality and open-affix option value;
7. market evidence and liquidity;
8. crafting option value and uncertainty;
9. meta prevalence as context only;
10. missing data and confidence.

## Sources reviewed

- GGG Early Access patch-note forum and official PoE2 ascendancy announcement.
- PoE2 Wiki modifier, Spirit and crafting references.
- poe.ninja public character/build representations.
- Patch 0.5 build material from Fubgun and Mobalytics' creator collection/tier-list team.
- Patch 0.5 campaign material from Travic.
- Reddit r/PathOfExile2 and r/pathofexile2builds question, crafting and build-help threads.
- Ghazzy crafting-guide discussion and community reports about failed crit transitions, misleading bow DPS and resistance/attribute breakpoints.

No community claim in this document is automatically active in production scoring.

## Direct references

- [GGG patch notes index](https://www.pathofexile.com/forum/view-forum/2212)
- [Version 0.5.0 mechanics and balance changes](https://www.poe2wiki.net/wiki/Version_0.5.0)
- [Current character classes](https://www.poe2wiki.net/wiki/Character_class)
- [Modifier domains and local/global behavior](https://www.poe2wiki.net/wiki/Modifier)
- [Item level and affix eligibility](https://www.poe2wiki.net/wiki/Item_level)
- [Spirit mechanics and sources](https://www.poe2wiki.net/wiki/Spirit)
- [Minion mechanics](https://www.poe2wiki.net/wiki/Minion)
- [Runic Ward mechanics](https://www.poe2wiki.net/wiki/Runic_Ward)
- [Crafting overview](https://www.poe2wiki.net/wiki/Crafting)
- [Fubgun Ice Shot Deadeye 0.5 progression variants](https://mobalytics.gg/poe-2/builds/ice-shot-deadeye)
- [Ignatius Spark Stormweaver 0.5 progression guide](https://mobalytics.gg/poe-2/builds/ignatius-spark-stormweaver)
- [animeprincess CoC Comet transition guide](https://mobalytics.gg/poe-2/builds/animeprincess-coc-comet-stormweaver)
- [Ronarray Chaos Lich 0.5 progression guide](https://mobalytics.gg/poe-2/builds/ronarray-minion-lich)
- [GL1TCH3D Chronomancer 0.5 build](https://mobalytics.gg/poe-2/builds/machine-gun-chronomancer-gl1tch3d)
- [Ronarray Martial Artist progression and video index](https://mobalytics.gg/poe-2/builds/martial-artist-monk-build-league-starter-to-endgame)
- [Dreamcore Acolyte of Chayula 0.5](https://mobalytics.gg/poe-2/builds/dreamcore-tornado-sprinkler)
- [Big Ducks Explosive Witchhunter 0.5](https://mobalytics.gg/poe-2/builds/explosive-witchhunter)
- [MisoxShiru Bitter Dead Gemling 0.5](https://mobalytics.gg/poe-2/builds/bitter-dead-gemling-legionnaire)
- [GuyThatDies Mercenary grenade leveling](https://mobalytics.gg/poe-2/builds/mercenary-grenades-leaguestarter)
- [Snoobae/CaptainLance/Kripp Huntress build index](https://mobalytics.gg/poe-2/huntress-builds)
- [MisoxShiru Glacial Lance Ritualist](https://mobalytics.gg/poe-2/builds/misoxshiru-glacial-lance-ritualist)
- [Raxx Plant Oracle 0.5](https://mobalytics.gg/poe-2/builds/plant-druid-oracle-endgame-guide)
- [CaptainLance Meteor Bear Shaman](https://mobalytics.gg/poe-2/builds/meteor-bear-druid)
- [PhazePlays Disciple of Varashta Djinn](https://mobalytics.gg/poe-2/builds/sandscorcher-disciple-of-varashta)
- [PaintMaster Disciple Comet item priorities](https://mobalytics.gg/poe-2/builds/comet-disciple-of-varashta)
- [Current poe.ninja character representation](https://poe.ninja/poe2/builds/runesofaldur/character/wintermute_42-4735/wintermute_monk_lynx)

## Live-state research refresh — 2026-07-15

The authoritative patch index inspected on this date identifies **0.5.4b Hotfix 3** as the newest live entry. The working league is **Runes of Aldur**. Research artifacts therefore target that line; older 0.2–0.4 material is historical context and cannot silently provide current numbers.

The current playable roster is eight base classes and 22 regular ascendancies, with Abyssal Lich tracked separately as an alternate ascendancy. Marauder, Duelist, Shadow and Templar remain planned/unavailable unless a later official patch changes the roster. The full mapping, evidence and timeline are in [CLASS_ASCENDANCY_MATRIX.md](./CLASS_ASCENDANCY_MATRIX.md).

### Corrected taxonomy

- Spirit Walker belongs to **Huntress**, alongside Amazon and Ritualist.
- Martial Artist belongs to **Monk**, alongside Invoker and Acolyte of Chayula.
- Druid currently maps to Shaman and Oracle in the live roster.
- Abyssal Lich must not be counted as a regular third Witch choice or used to inflate the regular-ascendancy count beyond 22.

### Spirit Walker modelling requirements

Spirit Walker cannot be represented as a generic minion build. Its model needs separate state for Vivid Wisps/Vivid Stampede, Primal Bounty/Owl Feathers, Soaring Ground, Wild Protector, the Tame Beast unique-companion limit, Azmeri Spirit possession rotation, Idolatry, Idols and non-Idol Augments. Idolatry's player and companion modifiers must retain their stated scope, and the non-Idol resistance penalty must participate in replacement checks. AI contact, command behaviour, possession uptime and movement uptime remain scenario inputs or unknown; they are not inherited from guide claims.

### Martial Artist modelling requirements

Martial Artist needs explicit Hollow state, Hollow Focus/Resonance, Combo state, Martial Adept/Master weapon-set behaviour, Runic Meridians body-rune sockets, transformed glove state from Way of the Stonefist and Surpassing/Immobilise state from Way of the Mountain. An unarmed end-state item is a transition package, not an isolated upgrade. Bells, illusions and rune effects must remain separate components until their skill text and scope are versioned.

### Cross-cutting findings

- Player, minion, companion, totem and ascendancy-granted effects require separate actor scopes.
- Spirit and reservation must be evaluated for the active weapon set and complete roster.
- Shapeshifting needs a form-state contract before Druid damage can be evaluated safely.
- Additional projectiles remain clear/coverage metadata unless a sourced skill policy permits same-target hits.
- Armour requires a versioned formula and incoming-hit scenario; no single context-free percentage is acceptable.
- Creator/video and Reddit material can propose fixtures, transitions and failure modes. It cannot activate a production formula.
- poe.ninja can provide dated co-occurrence observations only. The single character inspected during this run is an example (`n=1`), not a power or prevalence estimate.

The complete coverage gaps, source conflicts, archetype targets, video limitations and ordered implementation tasks are maintained in:

- [MECHANIC_COVERAGE_MATRIX.md](./MECHANIC_COVERAGE_MATRIX.md)
- [SOURCE_CONFLICT_LEDGER.md](./SOURCE_CONFLICT_LEDGER.md)
- [BUILD_ARCHETYPE_MATRIX.md](./BUILD_ARCHETYPE_MATRIX.md)
- [VIDEO_RESEARCH_LEDGER.md](./VIDEO_RESEARCH_LEDGER.md)
- [IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md)
