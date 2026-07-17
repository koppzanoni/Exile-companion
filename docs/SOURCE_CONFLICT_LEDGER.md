# Source conflict ledger

Verified: 2026-07-15. This ledger records conflicts rather than silently choosing whichever page is most convenient.

| Topic | Conflicting statements | Resolution used by the app/research | Confidence / action |
|---|---|---|---|
| Live patch | search results and cached guide pages mention 0.5.0, 0.5.4 or 0.5.4b | official GGG Early Access patch index lists 0.5.4b Hotfix 3 latest on inspection | High; recheck on every catalog import |
| Number of ascendancies | older ascendancy overview says 20; current category lists 23 pages; third parties say 22 | 22 regular ascendancies across eight playable classes plus Abyssal Lich as one alternate = 23 pages | High |
| Spirit Walker class | local app assigned it to Druid; current sources assign it to Huntress | corrected local taxonomy to Huntress | High; regression added |
| Martial Artist availability | local app omitted it; pre-0.5 pages list two Monk ascendancies | 0.5.0 introduced it as Monk’s third ascendancy | High; regression added |
| Druid third ascendancy | final-game descriptions say three per class; current Druid page shows Oracle, Shaman, TBA | only Oracle and Shaman are currently selectable | High; do not invent third |
| “12 playable classes” wording | wiki describes the designed twelve-class system, while current roster details four unavailable classes | distinguish planned system (12) from live selectable roster (8) | High |
| Spirit Walker versus Ritualist in 0.5 summaries | one low-quality guide calls Ritualist the new 0.5 ascendancy | official/current version history identifies Spirit Walker and Martial Artist | High; reject that guide for roster facts |
| Spirit reservation for item/ascendancy-granted persistent minions | generic Spirit descriptions imply persistent minions reserve; exceptions exist for item/ascendancy-granted skills | record explicit grant source and reservation exception per skill | Medium/High; needs profile field |
| Additional projectiles | guide language often equates more projectiles with more damage | Deadeye text grants a projectile, not universal same-target collision | High; clear coverage only unless skill policy proves multiplicity |
| poe.ninja DPS | character pages label estimates; creators quote much larger configured figures | treat as model output tied to imported configuration, never authoritative game DPS | High |
| Creator timestamps | search summaries sometimes generate chapter-like timestamps without accessible original transcript | only record timestamps present on an accessible source/chapter list; mark summaries as secondary | High |
| Armour | community calculators may show a single percentage | mitigation varies by incoming hit and applicability; no generic percentage is accepted | High policy; exact 0.5.4b formula still to catalog |
| Abyssal Lich count | some lists call it a fourth Witch ascendancy | it is an alternate unlocked from Lich and replaces corresponding nodes | High |

## Rejected-source patterns

- SEO pages that list unavailable Templar/Shadow builds as current POE2 options.
- Pages that confuse Path of Exile 1 version numbers or mechanics with POE2 Early Access.
- Build articles without patch/date or an inspectable loadout.
- Search-generated video summaries treated as transcripts.
- DPS titles used as evidence without configuration, target and calculation model.

## Authoritative ordering

1. Current official GGG patch notes or game-export data.
2. Current structured data with explicit version history.
3. Maintained community wiki, corroborated where material.
4. Reproducible community test with inputs and patch.
5. Current build guide or video as a configuration example.
6. Reddit/forum report as a hypothesis.

Sources: [GGG patch index](https://www.pathofexile.com/forum/view-forum/2212), [0.5.4b notes](https://www.pathofexile.com/forum/view-thread/3980516), [class roster](https://www.poe2wiki.net/wiki/Character_class), [ascendancy category](https://www.poe2wiki.net/wiki/Category:Ascendancy_classes).
