# Final Recommendation

The Final Recommendation is a deterministic decision layer that runs after parsing, category analysis, Build Fit, Trade2 lookup, and pricing. It turns that evidence into one conservative action: **Use, Sell, Craft, Replace Soon, Price Check, Vendor, or Keep for Later**.

## Decision inputs

The engine considers parsed stats, category and category score, selected-build fit, rarity, item level, corruption, quality, displayed roll tiers, missing and wasted stats, market appeal, crafting potential, price confidence, and whether official Trade2 verified the price live. Best-use context can be leveling, campaign, early maps, endgame, bossing, niche, or vendor.

With no selected profile, general usefulness and market coherence are used without claiming a character-specific fit.

## Actions

- **Use** requires strong selected-build fit and coherent category quality. Boots without movement speed cannot receive a strong Use recommendation.
- **Sell** requires useful quality, poor current-build fit, and real live official Trade2 evidence.
- **Craft** requires a worthwhile rare base, adequate item level, good existing structure, and a manageable number of improvements.
- **Replace Soon** means usable now but structurally flawed, such as Boots missing movement speed.
- **Price Check** protects uniques, build-enabling modifiers, high-tier rolls, unusual corruption, niche combinations, and plausible value without live verification.
- **Keep for Later** preserves off-build, progression, alternate-character, or future-project value.
- **Vendor** is the last resort: quality, category score, build fit, crafting potential, and marketability must all be low, with no hidden-value signal.

## Why Vendor is conservative

Unique items and detected build-enabling modifiers are never automatically vendored. Poor selected-build fit alone is insufficient: a good off-build item becomes Sell, Price Check, or Keep. Uncertainty also falls back to Keep or Price Check.

## Trade2 and Build Fit

Only `dataSource: live` plus a real estimate counts as live verification. Cached and manual evidence can inform pricing but cannot create a confirmed Sell recommendation. When live verification fails, the card clearly warns that no live price was verified.

High Build Fit can make Use correct even when market value is modest. A good item with poor fit becomes Sell only with live evidence; otherwise it becomes Price Check or Keep.

## Crafting potential

Crafting potential is scored 0–100 and labeled Do Not Craft, Low Potential, Maybe Craft, Good Crafting Base, High Potential, or Premium Crafting Base. The Final Recommendation consumes this same full result, so Craft is selected only when the base, rolls, risks, and fixable missing stats justify it. Many missing/wasted modifiers, a weak base, leveling-only use, unique rarity, and especially corruption suppress Craft. See `docs/crafting-potential.md`.

Every response includes next steps, warnings, hidden-value flags, improvement targets, pre-sale checks, and explicit `safeToVendor`, `manualPriceCheck`, and `mayHaveHiddenValue` signals.
