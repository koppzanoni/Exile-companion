export interface ModifierCatalogEntry {
  id: string;
  group: string;
  type: 'prefix' | 'suffix' | 'implicit';
  local: boolean;
  hybrid: boolean;
  tags: string[];
  statKeys: string[];
  pattern: string;
  flags: string;
  label: string;
  validClasses: string[];
}

const w = (source: string) => `${source}`;

export const defaultModifierCatalog: ModifierCatalogEntry[] = [
  { id: 'life', group: 'MaximumLife', type: 'prefix', local: false, hybrid: false, tags: ['life'], statKeys: ['life'], pattern: w('to maximum Life'), flags: 'i', label: 'Maximum Life', validClasses: [] },
  { id: 'mana', group: 'MaximumMana', type: 'prefix', local: false, hybrid: false, tags: ['mana'], statKeys: ['mana'], pattern: w('to maximum Mana'), flags: 'i', label: 'Maximum Mana', validClasses: [] },
  { id: 'life-mana-hybrid', group: 'LifeManaHybrid', type: 'prefix', local: false, hybrid: true, tags: ['life', 'mana'], statKeys: ['life', 'mana'], pattern: w('to maximum Life and(?:\\s+\\d+(?:\\([^)]*\\))?\\s+to)? maximum Mana'), flags: 'i', label: 'Life and Mana (hybrid)', validClasses: [] },
  { id: 'fire-resistance', group: 'FireResistance', type: 'suffix', local: false, hybrid: false, tags: ['resistance', 'fire'], statKeys: ['fireResistance'], pattern: w('to Fire Resistance'), flags: 'i', label: 'Fire Resistance', validClasses: [] },
  { id: 'cold-resistance', group: 'ColdResistance', type: 'suffix', local: false, hybrid: false, tags: ['resistance', 'cold'], statKeys: ['coldResistance'], pattern: w('to Cold Resistance'), flags: 'i', label: 'Cold Resistance', validClasses: [] },
  { id: 'lightning-resistance', group: 'LightningResistance', type: 'suffix', local: false, hybrid: false, tags: ['resistance', 'lightning'], statKeys: ['lightningResistance'], pattern: w('to Lightning Resistance'), flags: 'i', label: 'Lightning Resistance', validClasses: [] },
  { id: 'chaos-resistance', group: 'ChaosResistance', type: 'suffix', local: false, hybrid: false, tags: ['resistance', 'chaos'], statKeys: ['chaosResistance'], pattern: w('to Chaos Resistance'), flags: 'i', label: 'Chaos Resistance', validClasses: [] },
  { id: 'dual-elemental-resistance', group: 'DualResistance', type: 'suffix', local: false, hybrid: true, tags: ['resistance'], statKeys: ['fireResistance', 'coldResistance', 'lightningResistance'], pattern: w('to (?:Fire and Cold|Cold and Lightning|Fire and Lightning) Resistances?'), flags: 'i', label: 'Dual Elemental Resistance (hybrid)', validClasses: [] },
  { id: 'strength', group: 'Strength', type: 'suffix', local: false, hybrid: false, tags: ['attribute'], statKeys: ['strength'], pattern: w('to Strength\\b'), flags: 'i', label: 'Strength', validClasses: [] },
  { id: 'dexterity', group: 'Dexterity', type: 'suffix', local: false, hybrid: false, tags: ['attribute'], statKeys: ['dexterity'], pattern: w('to Dexterity\\b'), flags: 'i', label: 'Dexterity', validClasses: [] },
  { id: 'intelligence', group: 'Intelligence', type: 'suffix', local: false, hybrid: false, tags: ['attribute'], statKeys: ['intelligence'], pattern: w('to Intelligence\\b'), flags: 'i', label: 'Intelligence', validClasses: [] },
  { id: 'spirit', group: 'Spirit', type: 'prefix', local: false, hybrid: false, tags: ['spirit'], statKeys: ['spirit'], pattern: w('to Spirit\\b'), flags: 'i', label: 'Spirit', validClasses: [] },
  { id: 'movement-speed', group: 'MovementVelocity', type: 'suffix', local: false, hybrid: false, tags: ['movement'], statKeys: ['movementSpeed'], pattern: w('increased Movement Speed'), flags: 'i', label: 'Movement Speed', validClasses: ['boots'] },
  { id: 'rarity', group: 'ItemRarity', type: 'suffix', local: false, hybrid: false, tags: ['utility', 'rarity'], statKeys: ['rarityFind'], pattern: w('increased Rarity of Items [Ff]ound'), flags: 'i', label: 'Rarity of Items Found', validClasses: [] },
  { id: 'stun-threshold', group: 'StunThreshold', type: 'prefix', local: false, hybrid: false, tags: ['defence'], statKeys: ['stunThreshold'], pattern: w('increased Stun Threshold'), flags: 'i', label: 'Stun Threshold', validClasses: [] },
  { id: 'physical-damage-percent-local', group: 'LocalPhysicalDamagePercent', type: 'prefix', local: true, hybrid: false, tags: ['damage', 'physical', 'weapon'], statKeys: [], pattern: w('increased Physical Damage'), flags: 'i', label: 'Local Physical Damage %', validClasses: ['weapon'] },
  { id: 'physical-damage-added-local', group: 'LocalAddedPhysicalDamage', type: 'prefix', local: true, hybrid: false, tags: ['damage', 'physical', 'weapon'], statKeys: ['physicalDamageMin', 'physicalDamageMax'], pattern: w('Adds \\d+(?:\\([^)]*\\))? to \\d+(?:\\([^)]*\\))? Physical Damage'), flags: 'i', label: 'Added Physical Damage (local)', validClasses: ['weapon'] },
  { id: 'fire-damage-added-local', group: 'LocalAddedFireDamage', type: 'suffix', local: true, hybrid: false, tags: ['damage', 'fire', 'weapon'], statKeys: ['fireDamageMin', 'fireDamageMax'], pattern: w('Adds \\d+(?:\\([^)]*\\))? to \\d+(?:\\([^)]*\\))? Fire Damage'), flags: 'i', label: 'Added Fire Damage (local)', validClasses: ['weapon'] },
  { id: 'cold-damage-added-local', group: 'LocalAddedColdDamage', type: 'suffix', local: true, hybrid: false, tags: ['damage', 'cold', 'weapon'], statKeys: ['coldDamageMin', 'coldDamageMax'], pattern: w('Adds \\d+(?:\\([^)]*\\))? to \\d+(?:\\([^)]*\\))? Cold Damage'), flags: 'i', label: 'Added Cold Damage (local)', validClasses: ['weapon'] },
  { id: 'lightning-damage-added-local', group: 'LocalAddedLightningDamage', type: 'suffix', local: true, hybrid: false, tags: ['damage', 'lightning', 'weapon'], statKeys: ['lightningDamageMin', 'lightningDamageMax'], pattern: w('Adds \\d+(?:\\([^)]*\\))? to \\d+(?:\\([^)]*\\))? Lightning Damage'), flags: 'i', label: 'Added Lightning Damage (local)', validClasses: ['weapon'] },
  { id: 'attack-speed-local', group: 'LocalAttackSpeed', type: 'suffix', local: true, hybrid: false, tags: ['speed', 'attack', 'weapon'], statKeys: ['attackSpeedBonus'], pattern: w('increased Attack Speed'), flags: 'i', label: 'Attack Speed (local)', validClasses: ['weapon'] },
  { id: 'critical-chance-local', group: 'LocalCriticalChance', type: 'suffix', local: true, hybrid: false, tags: ['critical', 'weapon'], statKeys: ['criticalHitChance'], pattern: w('increased Critical (?:Hit )?Chance'), flags: 'i', label: 'Critical Hit Chance (local)', validClasses: ['weapon'] },
  { id: 'critical-damage-global', group: 'GlobalCriticalDamage', type: 'suffix', local: false, hybrid: false, tags: ['critical'], statKeys: ['criticalDamageBonus'], pattern: w('increased Critical Damage Bonus'), flags: 'i', label: 'Critical Damage Bonus', validClasses: [] },
  { id: 'armour-local', group: 'LocalArmour', type: 'prefix', local: true, hybrid: false, tags: ['defence', 'armour'], statKeys: ['armour'], pattern: w('increased Armour\\b'), flags: 'i', label: 'Armour (local)', validClasses: ['body-armour', 'helmet', 'gloves', 'boots', 'shield'] },
  { id: 'evasion-local', group: 'LocalEvasion', type: 'prefix', local: true, hybrid: false, tags: ['defence', 'evasion'], statKeys: ['evasion'], pattern: w('increased Evasion Rating'), flags: 'i', label: 'Evasion Rating (local)', validClasses: ['body-armour', 'helmet', 'gloves', 'boots'] },
  { id: 'armour-evasion-hybrid-local', group: 'LocalArmourEvasionHybrid', type: 'prefix', local: true, hybrid: true, tags: ['defence', 'armour', 'evasion'], statKeys: ['armour', 'evasion'], pattern: w('increased Armour and Evasion'), flags: 'i', label: 'Armour and Evasion (local, hybrid)', validClasses: ['body-armour', 'helmet', 'gloves', 'boots'] },
  { id: 'energy-shield-local', group: 'LocalEnergyShield', type: 'prefix', local: true, hybrid: false, tags: ['defence', 'energyshield'], statKeys: ['energyShield'], pattern: w('increased Energy Shield\\b'), flags: 'i', label: 'Energy Shield (local)', validClasses: ['body-armour', 'helmet', 'gloves', 'boots', 'focus'] },
  { id: 'deflection-local', group: 'LocalDeflection', type: 'prefix', local: true, hybrid: false, tags: ['defence', 'deflection'], statKeys: ['deflection'], pattern: w('increased Deflection'), flags: 'i', label: 'Deflection (local)', validClasses: ['body-armour', 'helmet', 'gloves', 'boots', 'shield'] },
  { id: 'runic-ward-local', group: 'LocalRunicWard', type: 'prefix', local: true, hybrid: false, tags: ['defence', 'runicward'], statKeys: ['runicWard'], pattern: w('increased Runic Ward'), flags: 'i', label: 'Runic Ward (local)', validClasses: ['focus'] },
  { id: 'block-chance-local', group: 'LocalBlockChance', type: 'suffix', local: true, hybrid: false, tags: ['defence', 'block'], statKeys: ['increasedBlockChance'], pattern: w('increased (?:Chance to Block|Block chance)'), flags: 'i', label: 'Block Chance (local)', validClasses: ['shield'] },
  { id: 'accuracy', group: 'Accuracy', type: 'suffix', local: false, hybrid: false, tags: ['accuracy'], statKeys: [], pattern: w('to Accuracy Rating'), flags: 'i', label: 'Accuracy Rating', validClasses: [] },
  { id: 'spell-damage', group: 'SpellDamage', type: 'prefix', local: false, hybrid: false, tags: ['damage', 'spell'], statKeys: ['spellDamage'], pattern: w('increased Spell Damage'), flags: 'i', label: 'Spell Damage', validClasses: [] },
  { id: 'cast-speed', group: 'CastSpeed', type: 'suffix', local: false, hybrid: false, tags: ['speed', 'cast'], statKeys: ['castSpeed'], pattern: w('increased Cast Speed'), flags: 'i', label: 'Cast Speed', validClasses: [] },
  { id: 'life-regeneration', group: 'LifeRegeneration', type: 'suffix', local: false, hybrid: false, tags: ['life', 'regeneration'], statKeys: ['lifeRegeneration'], pattern: w('Life Regeneration per second|Life [Rr]egenerat'), flags: '', label: 'Life Regeneration', validClasses: [] },
  { id: 'mana-regeneration', group: 'ManaRegeneration', type: 'suffix', local: false, hybrid: false, tags: ['mana', 'regeneration'], statKeys: ['manaRegeneration'], pattern: w('increased Mana Regeneration'), flags: 'i', label: 'Mana Regeneration', validClasses: [] },
  { id: 'skill-levels', group: 'SkillLevels', type: 'prefix', local: false, hybrid: false, tags: ['skill'], statKeys: [], pattern: w('to [Ll]evel of all[^\\n]*Skills'), flags: '', label: 'Level of All (X) Skills', validClasses: [] },
  { id: 'minion-damage', group: 'MinionDamage', type: 'prefix', local: false, hybrid: false, tags: ['minion', 'damage'], statKeys: [], pattern: w('Minions? deal increased Damage'), flags: 'i', label: 'Minion Damage', validClasses: [] },
  { id: 'projectile-count', group: 'ProjectileCount', type: 'suffix', local: false, hybrid: false, tags: ['projectile'], statKeys: ['projectileSkillLevels'], pattern: w('additional (?:Projectiles?|Arrows?)'), flags: 'i', label: 'Additional Projectiles', validClasses: [] },
];
