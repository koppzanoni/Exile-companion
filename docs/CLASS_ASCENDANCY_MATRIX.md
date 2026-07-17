# POE2 class and ascendancy matrix

Verified: 2026-07-15 (America/Sao_Paulo)  
Live line: **0.5.4b Hotfix 3**  
League: **Runes of Aldur**  
Scope: current Early Access roster, not the announced final roster.

## Evidence policy

`GGG` is authoritative for live patch state. `poe2wiki` is used for structured current descriptions and version history. A build guide or ladder character can demonstrate a configuration, but cannot establish a universal mechanic. Confidence below describes the identity-level mapping, not complete numerical coverage.

Primary references:

- [GGG Early Access patch index](https://www.pathofexile.com/forum/view-forum/2212) — shows 0.5.4b Hotfix 3 as the latest entry inspected.
- [GGG 0.5.4b notes](https://www.pathofexile.com/forum/view-thread/3980516).
- [Current character-class roster](https://www.poe2wiki.net/wiki/Character_class).
- [Current ascendancy category](https://www.poe2wiki.net/wiki/Category:Ascendancy_classes).
- [0.5 passive-tree version history](https://poe.ninja/posts/poe2-tree-version-history).

## Playable base classes

| Base class | Attribute family | Native identity (not a restriction) | Regular ascendancies | Confidence / limitation |
|---|---|---|---|---|
| Warrior | Strength | mace, shield, slam, warcry | Titan; Warbringer; Smith of Kitava | High; a class can use off-identity skills |
| Ranger | Dexterity | bow, ranged projectile | Deadeye; Pathfinder | High |
| Huntress | Dexterity | spear, hybrid melee/projectile | Amazon; Ritualist; Spirit Walker | High; Spirit Walker was added in 0.5.0 |
| Mercenary | Strength/Dexterity | crossbow, ammunition, grenade | Witchhunter; Gemling Legionnaire; Tactician | High |
| Monk | Dexterity/Intelligence | quarterstaff, unarmed, combo | Invoker; Acolyte of Chayula; Martial Artist | High; Martial Artist was added in 0.5.0 |
| Witch | Intelligence | occult spells, chaos, undead/minions | Infernalist; Blood Mage; Lich | High; Abyssal Lich is alternate, not a fourth regular choice |
| Sorceress | Intelligence | elemental spells | Stormweaver; Chronomancer; Disciple of Varashta | High |
| Druid | Strength/Intelligence | shapeshifting, animal minions, nature spells | Shaman; Oracle | High; third regular ascendancy remains unavailable |

## Planned but not currently playable

| Planned class | Expected identity | Status on verification date |
|---|---|---|
| Marauder | axe | Not in current playable roster |
| Duelist | sword | Not in current playable roster |
| Shadow | dagger/trap | Not in current playable roster |
| Templar | flail/holy spell | Not in current playable roster |

These names must never be offered as importable current classes until a future patch catalog explicitly activates them.

## Regular ascendancies (22)

| Class / ascendancy | Identity and explicit mechanics that affect analysis | Required model domains | Known limitations | Core source |
|---|---|---|---|---|
| Warrior / Titan | slams, aftershocks, Heavy Stun, life/armour, small-passive effect | slam components, stun state, every-third-use rotation | aftershock overlap and target geometry need skill profiles | [Titan](https://www.poe2wiki.net/wiki/Titan) |
| Warrior / Warbringer | Armour Break, warcries, block, totems/Ancestral Spirits, hit redirection | fully-broken state, corpse explosion, totem life and uptime | ancestor AI and corpse availability are scenarios | [Warbringer](https://www.poe2wiki.net/wiki/Warbringer) |
| Warrior / Smith of Kitava | smithing/forging and equipment-dependent bonuses | item-state transforms, body-armour constraints, augment legality | current app lacks ascendancy equipment transforms | [Smith of Kitava](https://www.poe2wiki.net/wiki/Smith_of_Kitava) |
| Ranger / Deadeye | projectile distance, extra projectile, Tailwind, Frenzy, marks, Mirage Deadeye | distance, projectile policy, hit-loss state, mirage cooldown | extra projectile is not automatic single-target DPS | [Deadeye](https://www.poe2wiki.net/wiki/Deadeye) |
| Ranger / Pathfinder | flasks/concoctions, movement, Poison stacks, alternative tree start, evasion-derived elemental reduction | flask charges, poison duration/limit, travel-tree catalog | flask uptime and concoction charge use need rotation | [Pathfinder](https://www.poe2wiki.net/wiki/Pathfinder) |
| Huntress / Amazon | spear accuracy/crit, melee and thrown-spear paths | weapon hand, accuracy, projectile/melee components | archetype-specific skills still need profiles | [Amazon](https://www.poe2wiki.net/wiki/Amazon) |
| Huntress / Ritualist | Blood Boils, stolen modifiers, life recovery, charms, third ring and jewellery amplification | random stolen state, charm charges, added ring slot, reservation penalties | monster modifiers cannot be valued without exact identity | [Ritualist](https://www.poe2wiki.net/wiki/Ritualist) |
| Huntress / Spirit Walker | Stag/Owl/Bear spirits, companions, tame unique beasts, Idols and reservation | companion actor, Presence, Spirit roster, movement, possession rotation, augment topology | AI/contact uptime and beast-specific skills are unknown without scenario | [Spirit Walker](https://www.poe2wiki.net/wiki/Spirit_Walker) |
| Mercenary / Witchhunter | Decimating/Culling, Concentration, Sorcery Ward, on-kill explosion, weapon-set specialization | target initial life, boss threshold, barrier, kill event, set-local state | execute effects must not be averaged as ordinary DPS | [Witchhunter](https://www.poe2wiki.net/wiki/Witchhunter) |
| Mercenary / Gemling Legionnaire | gem colours/counts, quality alternate effects, skill levels, attributes, Virtuous Barrier | complete socket inventory, quality schema, requirement solver | every gem’s alternate quality must be versioned | [Gemling Legionnaire](https://www.poe2wiki.net/wiki/Gemling_Legionnaire) |
| Mercenary / Tactician | banners/allies, reduced reservation, Pin/immobilise, armour/evasion, totems, Supporting Fire | ally scope, banner state, control buildup, reservation and cooldown | ally contribution cannot be applied to player without explicit scope | [Tactician](https://www.poe2wiki.net/wiki/Tactician) |
| Monk / Invoker | elemental attacks, ailments, Spirit from body armour, evasion/ES interactions | body-armour-derived Spirit, ailment thresholds, reservation | body armour changes both defence and roster capacity | [Invoker](https://www.poe2wiki.net/wiki/Invoker) |
| Monk / Acolyte of Chayula | Darkness/chaos, mana/ES interactions, breach-themed resources | resource timeline, chaos conversion/gain, recovery | uptime and pickup geometry are scenario-dependent | [Acolyte of Chayula](https://www.poe2wiki.net/wiki/Acolyte_of_Chayula) |
| Monk / Martial Artist | Hollow Form/Focus/Resonance, bells, Combo, body rune sockets, Fists of Stone, Immobilise | clone/bell components, Combo rotation, rune limits, glove transform, weapon-set retention | illusion targeting and bell hits need measured scenario | [Martial Artist](https://www.poe2wiki.net/wiki/Martial_Artist) |
| Witch / Infernalist | Infernal Flame, Demon Form, life reservation contracts, Hellhound, self-Ignite | resource failure threshold, transformation, reserved life, companion actor | high-flame and Demonflame uptime require rotation | [Infernalist](https://www.poe2wiki.net/wiki/Infernalist) |
| Witch / Blood Mage | life costs, Life Remnants/overflow, spell crit, delayed life loss, body-armour ES to life | dual cost, pickup/remnant state, crit base override, recovery timeline | mapping remnant availability cannot be assumed for bosses | [Blood Mage](https://www.poe2wiki.net/wiki/Blood_Mage) |
| Witch / Lich | curses, ES sacrifice/cast coupling, Power Charges, minion/offering paths | ES current-state, charge consumption, curses, minion roster | alternate Abyssal mapping must not be merged into regular Lich | [Lich](https://www.poe2wiki.net/wiki/Lich) |
| Sorceress / Stormweaver | stacked Shock/Chill, Elemental Storm, Infusions, Arcane Surge, mana protection | ailment magnitudes/stacks, crit-trigger cooldown, remnant state, MoM-like pool | crit does not guarantee Shock; storm limit/cooldown matter | [Stormweaver](https://www.poe2wiki.net/wiki/Stormweaver) |
| Sorceress / Chronomancer | cooldown reset, Time Freeze, Temporal Rift, delayed damage, repeat chance | timeline simulation, cooldown state, rewindable pools | utility cannot be flattened into permanent DPS/EHP | [Chronomancer](https://www.poe2wiki.net/wiki/Chronomancer) |
| Sorceress / Disciple of Varashta | Djinn-related granted mechanics and elemental/companion-like components | granted-skill actors, cooldowns, component attribution | current evaluator has no Djinn actor profile | [Disciple of Varashta](https://www.poe2wiki.net/wiki/Disciple_of_Varashta) |
| Druid / Shaman | Spirit from empty Charm slots, primal/nature paths and persistent packages | charm opportunity cost, Spirit roster, shapeshift state | empty charm slots are not free power; lost charm utility must be compared | [Shaman](https://www.poe2wiki.net/wiki/Shaman) |
| Druid / Oracle | Foresight/Align Fate, immobilise, forced crit, exclusive tree paths, totem/minion survival interactions | random future skill, cooldown recovery, tree topology, target state | random visions and special passive access require exact catalog | [Oracle](https://www.poe2wiki.net/wiki/Oracle) |

## Alternate ascendancy

| Alternate | Unlock and replacement semantics | Required model domains | Source |
|---|---|---|---|
| Witch / Abyssal Lich | Unlock follows regular Lich; selected nodes are replaced while positions remain corresponding | variant identity, node replacement, Umbral Souls, enemy-targeted Offerings, ES sacrifice, Power Charge apparition, curse explosion | [Abyssal Lich](https://www.poe2wiki.net/wiki/Abyssal_Lich) |

It must be represented as a versioned variant of Lich, not counted as a regular fourth Witch ascendancy and not silently inferred from the name “Lich”.

## Timeline relevant to the analyzer

| Version | Research consequence | Evidence |
|---|---|---|
| 0.2.0 | Huntress, Amazon/Ritualist and broad skill changes entered the live game | [0.2.0 notes](https://www.pathofexile.com/forum/view-thread/3740562/filter-account-type/staff) |
| 0.3.0 | support system overhaul; Abyssal Lich appeared as alternate | [0.3.0 notes](https://www.pathofexile.com/forum/view-thread/3826682/filter-account-type/staff) |
| 0.4.0 | Druid, Oracle/Shaman, Talismans, primal skills; socketables renamed to Augments and old Augment Talismans to Idols | [0.4.0 notes](https://www.pathofexile.com/forum/view-thread/3883495/filter-account-type/staff) |
| 0.5.0 | Spirit Walker and Martial Artist introduced; passive tree version changed | [0.5.0 history](https://www.poe2wiki.net/wiki/Version_0.5.0) |
| 0.5.4b | current inspected minor release; contains Martial Artist rune/Stonefist fixes | [GGG notes](https://www.pathofexile.com/forum/view-thread/3980516) |
| 0.5.4b Hotfix 3 | latest official forum entry at verification time | [GGG patch index](https://www.pathofexile.com/forum/view-forum/2212) |
