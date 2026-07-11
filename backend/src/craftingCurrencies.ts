export type CraftRarity = 'normal' | 'magic' | 'rare';
export type CraftEffect = 'upgrade-rarity-magic' | 'upgrade-rarity-rare' | 'add-affix' | 'remove-affix' | 'reroll-numeric';
export type OutcomeCertainty = 'guaranteed' | 'random-from-pool';

export interface CraftingCurrencyDef {
  id: string;
  label: string;
  compatibleRarities: CraftRarity[];
  effect: CraftEffect;
  reversible: false;
  outcomeCertainty: OutcomeCertainty;
  knownChance?: number;
}

export const craftingCurrencies: CraftingCurrencyDef[] = [
  { id: 'orb-of-transmutation', label: 'Orb of Transmutation', compatibleRarities: ['normal'], effect: 'upgrade-rarity-magic', reversible: false, outcomeCertainty: 'guaranteed', knownChance: 1 },
  { id: 'orb-of-augmentation', label: 'Orb of Augmentation', compatibleRarities: ['magic'], effect: 'add-affix', reversible: false, outcomeCertainty: 'guaranteed', knownChance: 1 },
  { id: 'regal-orb', label: 'Regal Orb', compatibleRarities: ['magic'], effect: 'upgrade-rarity-rare', reversible: false, outcomeCertainty: 'guaranteed', knownChance: 1 },
  { id: 'exalted-orb', label: 'Exalted Orb', compatibleRarities: ['rare'], effect: 'add-affix', reversible: false, outcomeCertainty: 'guaranteed', knownChance: 1 },
  { id: 'orb-of-annulment', label: 'Orb of Annulment', compatibleRarities: ['magic', 'rare'], effect: 'remove-affix', reversible: false, outcomeCertainty: 'random-from-pool' },
  { id: 'divine-orb', label: 'Divine Orb', compatibleRarities: ['magic', 'rare'], effect: 'reroll-numeric', reversible: false, outcomeCertainty: 'random-from-pool' },
];

export function findCurrency(id: string): CraftingCurrencyDef | undefined {
  const normalized = id.toLowerCase();
  return craftingCurrencies.find((c) => c.id === normalized || c.label.toLowerCase() === normalized);
}
