# Equipped Item Comparison

The Analyzer can compare a **New Item** with the **Current Equipped Item** without leaving the page. Enable **Compare with Equipped Item**, paste the current item, and optionally enter current character resistance and attribute totals. If no equipped item is supplied, analysis works normally.

## What is compared

Both items are independently parsed, category-scored, and evaluated against the selected Build Fit profile. The comparison combines universal quality, category score, build fit, offence, defence, and utility. It reports raw stat deltas, main gains/losses, confidence, risks, areas improved or weakened, and how the swap changes the Final Recommendation.

Weapons prioritize displayed physical/elemental/total DPS, attack or cast speed, critical stats, flat damage, damage modifiers, skill levels, accuracy, leech, and build-specific offence. Weapon comparisons deliberately ignore missing life, resistances, Armour, Evasion, and Energy Shield.

Boots heavily weight movement speed. Shields heavily weight block and local defences. Quivers emphasize projectile offence. Jewellery emphasizes life, resistances, attributes, damage, resources, rarity, and build-enabling modifiers.

## Verdicts

Supported verdicts are Clear Upgrade, Small Upgrade, Sidegrade, Situational Upgrade, Defensive Upgrade, Offensive Upgrade, Downgrade, Not Comparable, and Needs Manual Review. An item can be an Offensive Upgrade while still losing enough defence to trigger a survivability warning. Sidegrade and Situational Upgrade mean the correct choice depends on the current content or whether losses can be fixed elsewhere.

## Resistance and attribute impact

When current totals are provided, the backend estimates each new total as:

`current total - equipped item contribution + new item contribution`

It warns when an elemental resistance that was at or above 75% falls below the cap, when a large resistance loss occurs, or when Strength, Dexterity, or Intelligence drops enough to threaten gem/gear requirements. Without totals, raw item-to-item losses are still shown.

## Compatibility

Armour and accessory slots compare only against the same category: Shield to Shield, Quiver to Quiver, Boots to Boots, Ring to Ring, and so on. Weapons compare across different weapon categories only when a specific selected profile explicitly supports both. Incompatible items return **Not Comparable** rather than a misleading score.

The equipped comparison is serialized inside saved checks. Market value is compared only when both sides have verified values; otherwise the card explains that a direct market winner cannot be determined.
