import type { ItemAction } from './types.js';

export const itemActionLabels: Record<ItemAction, { summary: string; next: string }> = {
  Use: {
    summary: 'This item directly helps the selected build.',
    next: 'Equip it and compare the character sheet or run the equipped-item comparison.',
  },
  Sell: {
    summary: 'This item has verified demand but is a poor match for the selected build.',
    next: 'Use the verified comparable range and list it near the fair price.',
  },
  Craft: {
    summary: 'The base and current affixes justify a controlled crafting attempt.',
    next: 'Improve one of the missing priority stats, then analyze the item again.',
  },
  'Replace Soon': {
    summary: 'The item is usable now but has a slot-defining weakness.',
    next: 'Keep using it temporarily while searching for the missing core stat.',
  },
  'Price Check': {
    summary: 'This item may be valuable, but the current market evidence is not conclusive.',
    next: 'Open the official Trade2 search and compare the important modifiers manually.',
  },
  Vendor: {
    summary: 'The item has no detected use, market hook, or realistic crafting path.',
    next: 'Vendor it unless you know of a special interaction the parser could not detect.',
  },
  'Keep for Later': {
    summary: 'The item is not for the current build but retains practical future use.',
    next: 'Store it for leveling, an alternate build, or a later crafting attempt.',
  },
};
