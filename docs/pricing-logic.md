# Pricing logic

Relic Lens estimates only when at least two sufficiently similar listings have usable Exalted or Divine prices. It does not infer a price from item stats alone.

## Item quality and build fit

Quality analysis is separate from market price and therefore works without listings. A deterministic 0–100 score considers only the stats relevant to the detected category. Item level is reported as affix/crafting potential; it does not make weak current rolls valuable by itself.

## Category-specific engine

The backend separates category detection, knowledge, scoring, and orchestration into `categoryDetection.ts`, `itemCategoryKnowledge.ts`, `categoryScoring.ts`, and `categoryAnalysis.ts`. Item Class is the strongest detection signal; base-type patterns are a lower-confidence fallback.

Supported categories are Body Armour, Helmet, Gloves, Boots, Shield, Focus, Quiver, Bow, Crossbow, one- and two-handed melee weapons, Staff, Quarterstaff, Wand, Sceptre, Ring, Amulet, and Belt. Each knowledge entry defines important, secondary, weak/wasted, market-relevant, and build-relevant signals plus Trade2 priorities.

The category score combines the detailed evaluator with category core-stat coverage and secondary-stat synergy:

- Boots require movement speed and lose substantial value when it is absent.
- Shields centre block and displayed local defence.
- Quivers are offensive projectile slots; defensive affixes are wasted opportunities.
- Attack weapons use displayed DPS, attack speed, critical, accuracy, and skill utility. They are never penalized for missing armour, life, Energy Shield, or resistances.
- Defensive weapon affixes are reported as weak/wasted mod slots.
- Body Armour uses its displayed local defence family rather than expecting all three defence types.

Advanced-description ranges such as `+34(31-35)%` are converted into within-range percentiles. Tier 1 is treated as the strongest affix tier. Roll signals make only a small quality adjustment; they do not override category fundamentals or build fit.

Weapons use a separate offensive model. Attack weapons are evaluated from displayed physical and elemental DPS, attacks per second, critical chance, local flat and percentage damage, attack speed, projectile utility, accuracy and leech. Caster weapons prioritise spell damage, cast speed, skill levels and relevant critical scaling. Missing life, Energy Shield or resistances is never a weapon penalty; defensive affixes on a weapon instead reduce quality because they consume mod slots that could provide offensive or build-enabling power.

The score maps to poor, basic, good, excellent, or elite. Build-fit profiles currently cover life/armour melee, life/evasion ranged, Energy Shield caster/CI, minion/Spirit, and magic-find mapping. Each profile reports matching priorities and conflicts. These profiles explain likely demand; they never create a currency value.

### Personalized build fit

The active **My Build** profile produces a separate 0–100 fit score. It never rewrites the universal quality grade. Required, high, and useful priorities have decreasing weights; explicit minimums replace automatic targets. Automatic targets scale down for campaign and early-map profiles.

Only stats that can reasonably matter on the inspected slot enter the denominator. Movement speed is boots-only, local DPS/attack speed/critical chance are weapon-only, base defences apply to armour slots, and Spirit is considered on amulets, body armour, and weapons. Custom modifier phrases can be scoped with prefixes such as `[weapon]`, `[boots]`, `[amulet]`, or `[jewellery]` so a weapon requirement never penalizes unrelated boots or rings.

The profile also chooses an evaluation approach. **Campaign Race** increases the influence of movement speed and immediately usable weapon output. **Hardcore/Gauntlet** increases defensive weights and caps an item's personalized score when a relevant required stat misses its floor. **Balanced** keeps the neutral weights. See `docs/racer-research.md` for the evidence and product reasoning; these modes are not player endorsements.

## Selected Build Fit

Build Fit is a separate 0–100 score driven by the selected profile. It considers category/base compatibility, offensive stats only on offensive slots, defensive stats only where meaningful, attributes, utility, missing priorities, wasted stats, and the category-specific score. It can influence the explanation and recommended action, but never the currency estimate. Live/cached/manual/none provenance remains unchanged.

Without a selection, Generic Build Fit is used and clearly labeled as general usefulness rather than build-specific advice. See `docs/build-fit.md`.

## Final recommendation

After quality, category, Build Fit, and pricing complete, a separate decision layer chooses Use, Sell, Craft, Replace Soon, Price Check, Vendor, or Keep for Later. Sell requires a real live Trade2 estimate; cached, manual, or unavailable pricing produces a warning and cannot manufacture a confirmed sale decision. Vendor requires every major quality/use/value signal to be weak and no hidden-value flag. See `docs/recommendations.md`.

## Equipped comparison

When an equipped item is supplied, both items receive independent category and Build Fit analysis. The swap verdict combines quality, category, build fit, offence, defence, utility, and slot-specific stat deltas. A confirmed downgrade blocks an automatic Use recommendation; a supported upgrade can promote Use. Weapon comparisons exclude defensive affixes from the comparison penalty. Market value is compared only when verified evidence exists for both items. See `docs/equipped-comparison.md`.

## Crafting potential and price

Crafting Potential is market-independent and remains available without Trade2. Base quality, roll quality, missing/wasted modifiers, category/build fit, corruption, and risk settings produce the crafting score. Live Trade2 does not increase the score; it only removes the warning to check comparable bases before expensive currency use. See `docs/crafting-potential.md`.

## Similarity score

The score is normalized to 0–100:

1. Exact base type is the strongest feature (35 raw points). A partial name match receives less credit.
2. Rarity adds 12 points. For a rare target, known non-rare listings are rejected.
3. Armour and jewellery compare defences, life, mana, elemental/chaos resistances, attributes, rarity find, spirit and stun threshold. Weapons compare physical/elemental damage ranges, attack speed and critical chance instead.
4. Item level adds a small closeness contribution.
5. Boots receive a dedicated 28-point movement-speed feature. Matching 25–30% movement speed strongly improves similarity; comparing speed boots with no-speed boots sharply lowers it.

Listings below 20% similarity cannot influence the estimate.

## Outliers and suspected price-fixing

The engine calculates Q1, median, Q3 and the interquartile range (IQR). Prices below `Q1 − 1.5×IQR` or above `Q3 + 1.5×IQR` are excluded. A seller with at least three listings below 65% of the median is marked as a suspected price-fixing cluster. Exclusions are displayed in the table.

If filtering would leave fewer than two listings, the engine conservatively restores the original comparable set and lowers confidence rather than pretending the small filtered sample is robust.

## Price tiers

Each retained price is weighted by similarity:

- **Quick sell:** the lesser of weighted Q1 and 88% of the fair value.
- **Fair listing:** weighted median.
- **High listing:** the greater of weighted Q3 and 116% of fair value.

Values under 10 Exalted retain one decimal; larger values round to whole Exalted. Divine equivalents use the user’s current manual conversion rate and round to two decimals.

## Confidence and explanation

Confidence combines retained listing count and mean similarity. Rare items need more evidence for high confidence because mod combinations vary greatly. The explanation calls out strong defences, life, resistance totals, movement speed, spirit and rarity find, plus missing life/resistance/speed drawbacks.
