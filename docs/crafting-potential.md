# Crafting Potential

Every analyzed item receives an independent 0–100 Crafting Potential result. It answers whether the base and current modifiers justify spending currency; it does not invent market value and it does not assume that a high item level fixes weak current rolls.

## Score components

The engine separates **Base Quality** and **Roll Quality**. Base Quality considers detected category/base, item level, quality, local defence or displayed weapon output, and category suitability. Roll Quality considers strong/high-tier rolls, weak or wasted modifiers, missing priorities, category-specific combinations, and selected-build relevance. Risk penalties then cover corruption, unique rarity, poor bases, too many missing/wasted modifiers, leveling-only use, and one excellent roll carrying an otherwise weak item.

Labels are Do Not Craft, Low Potential, Maybe Craft, Good Crafting Base, High Potential, and Premium Crafting Base. Results also include confidence, reasons, risks, best improvements, avoid actions, currency suggestions/warnings, and strong/weak/missing roll lists.

## Category rules

- Boots require movement speed. No-speed Boots are capped at low potential unless their life and resistance package is exceptional.
- Attack weapons prioritize DPS, speed, critical, flat/increased damage, accuracy, leech, and build offence. Low DPS plus defensive affixes is Do Not Craft.
- Caster weapons prioritize spell damage, cast speed, relevant critical stats, and skill levels.
- Shields value block, local defence, life, and resistances.
- Quivers require projectile offence; defensive-only Quivers are weak projects.
- Body Armour values local defence, life, resistances, and relevant Spirit.
- Jewellery values coherent life, resistance, attributes, damage/resources, rarity, and build-enabling modifiers.

## Currency advice

**Divine Orb** is suggested only when the item is already valuable, has multiple strong modifiers, and Advanced Item Description data shows useful numeric rolls that are still low or average. Otherwise the app explicitly says not to Divine.

**Exalted Orb** is suggested only for a good rare item with a likely open affix, no more than one or two fixable missing priorities, and few wasted modifiers. The app cannot prove affix space from incomplete text, so the advice always asks the user to confirm it.

**Regal Orb** is considered for a magic item only when the existing modifiers deserve preservation. Low-cost augmentation-style actions are limited to adequate normal/magic bases. Quality improvement is suggested before expensive crafting when an appropriate good base is below 20% quality.

Corrupted items are capped at Do Not Craft unless future game data provides a specifically supported corruption-crafting path. Leveling/campaign items receive explicit warnings against expensive investment.

## Settings and market data

Settings expose Low/Medium/High risk tolerance, currency-warning visibility, and conservative recommendations. Low tolerance applies a stricter penalty; conservative mode caps optimistic results for weak or leveling-only items.

Crafting analysis remains available when Trade2 fails, but high-potential items warn the user to verify comparable bases before expensive currency use. Crafting advice never creates a market price.
