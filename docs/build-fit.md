# Build Fit Analysis

Build Fit is independent from universal item quality, category score, and market price. It answers: **does this item help the selected build?**

## Selecting a profile

The Analyzer defaults to **Generic Build Fit**, which measures broad category usefulness and explains that no specific build was selected. The selector includes 17 code-defined profiles:

- Ice Shot Deadeye and Lightning Arrow Deadeye
- Crossbow Mercenary
- Lightning Monk and Quarterstaff Monk
- Minion Witch
- Cold, Fire, and Lightning Caster
- Armour/Life Warrior, Evasion Ranger, and Energy Shield Caster
- Generic Melee, Projectile Attack, Spell Caster, Minion, and Defensive Leveling

Each profile defines preferred weapons, damage types, defensive layers, offensive/defensive/attribute/utility priorities, wasted stats, valuable slots, category overrides, and explanation rules.

## Score and recommendation

The 0–100 score combines category/base compatibility, relevant parsed stats, category score, missing requirements, and wasted affixes. Offensive stats enter the score only on offensive slots; defensive stats on attack weapons do not improve fit. Labels are Bad, Usable, Good, Great, and Build-defining.

The result reports best use (leveling, campaign, early maps, endgame, bossing, niche, or vendor) and a build-only action hint. The Analyzer's **Final Recommendation** is authoritative because it also includes market verification, crafting potential, hidden value, corruption, rarity, and general category quality. See `docs/recommendations.md`.

## Custom profiles

Custom profiles are created on **My Build → Custom Build Fit Profiles** and saved in SQLite `build_profiles`. They immediately appear in the Analyzer selector. Code-defined defaults cannot be edited or deleted. The API supports full CRUD for custom profiles.

Build fit never creates a price. Market estimates still require live, cached, or explicitly manual listing evidence.
