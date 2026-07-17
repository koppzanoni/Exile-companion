import type { CraftingSettings, ItemStats } from './types.js';
import type { CraftingFacts } from './craftingRules.js';

export function buildCurrencyAdvice(
  item: ItemStats,
  facts: CraftingFacts,
  score: number,
  settings: CraftingSettings,
  marketVerified: boolean,
) {
  const suggestedCurrencyUse: string[] = [];
  const currencyWarnings: string[] = [];
  const expensiveAllowed = !item.corrupted && !['leveling', 'campaign'].includes(facts.bestUseCase);
  const valuableRollSet = score >= 75 && facts.strongRolls.length >= 2 && facts.categoryScore >= 60;
  if (expensiveAllowed && valuableRollSet && facts.lowNumericRolls.length > 0)
    suggestedCurrencyUse.push(
      `Consider a Divine Orb only because valuable modifiers have improvable numeric rolls: ${facts.lowNumericRolls.slice(0, 2).join(', ')}.`,
    );
  else
    currencyWarnings.push(
      'Do not use a Divine Orb: the item does not have enough valuable modifiers with poor numeric rolls to justify rerolling values.',
    );
  const exaltCandidate =
    expensiveAllowed &&
    item.rarity === 'rare' &&
    score >= 60 &&
    facts.missing.length >= 1 &&
    facts.missing.length <= 2 &&
    facts.wasted.length <= 1 &&
    facts.modCount < 6;
  if (exaltCandidate)
    suggestedCurrencyUse.push(
      `Maybe worth an Exalted Orb if an affix is open; the item is missing ${facts.missing.slice(0, 2).join(' or ')}.`,
    );
  else
    currencyWarnings.push(
      'Do not use an Exalted Orb unless an affix is confirmed open and the item has only one or two fixable missing stats.',
    );
  const chaosCandidate =
    expensiveAllowed && item.rarity === 'rare' && score >= 55 && facts.modCount >= 6 && facts.wasted.length === 1;
  if (chaosCandidate)
    suggestedCurrencyUse.push(
      `Consider a Chaos Orb to reroll the one wasted affix (${facts.wasted[0]}) while keeping the rest — there is no open slot for an Exalted Orb.`,
    );
  else if (item.rarity === 'rare' && facts.modCount >= 6 && facts.wasted.length > 1)
    currencyWarnings.push(
      'Do not use a Chaos Orb: more than one affix is wasted, so a single reroll is unlikely to fix the item.',
    );
  if (item.rarity === 'magic' && score >= 48)
    suggestedCurrencyUse.push(
      'A Regal Orb can make sense after confirming the existing magic modifiers are worth preserving.',
    );
  else if (item.rarity === 'magic')
    currencyWarnings.push('Do not Regal this item until the existing magic modifiers are strong enough to preserve.');
  if ((item.rarity === 'normal' || item.rarity === 'magic') && score >= 35)
    suggestedCurrencyUse.push('A low-cost augmentation-style improvement may be reasonable if an affix is available.');
  if (item.rarity === 'normal' && facts.baseQuality.score >= 48)
    suggestedCurrencyUse.push(
      'An Orb of Alchemy can take this base straight to Rare with four affixes at once, instead of the slower Transmutation/Augmentation/Regal path.',
    );
  if (
    !item.corrupted &&
    (item.quality || 0) < 20 &&
    facts.baseQuality.score >= 50 &&
    [
      'body-armour',
      'helmet',
      'gloves',
      'boots',
      'shield',
      'bow',
      'crossbow',
      'one-handed-melee',
      'two-handed-melee',
      'quarterstaff',
    ].includes(facts.category)
  )
    suggestedCurrencyUse.push('Apply an appropriate quality improvement before expensive crafting.');
  if (score < 35 || item.corrupted) suggestedCurrencyUse.unshift('Do not spend meaningful currency on this item.');
  if (!marketVerified && score >= 55)
    currencyWarnings.push(
      'Live Trade2 value is not verified; check comparable bases before spending expensive currency.',
    );
  if (['leveling', 'campaign'].includes(facts.bestUseCase))
    currencyWarnings.push('Avoid expensive currency on a leveling-only item.');
  return {
    suggestedCurrencyUse: unique(suggestedCurrencyUse),
    currencyWarnings: settings.showCurrencyWarnings ? unique(currencyWarnings) : [],
  };
}
const unique = <T>(values: T[]) => [...new Set(values)];
