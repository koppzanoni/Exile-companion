import type { ItemCategory, ItemCategoryInfo, ItemStats } from './types.js';

export interface CategoryRule {
  label: string;
  test: (item: ItemStats, text: string) => boolean;
}

export interface CategoryKnowledge {
  info: ItemCategoryInfo;
  important: CategoryRule[];
  secondary: CategoryRule[];
  weak: CategoryRule[];
  market: CategoryRule[];
  build: CategoryRule[];
  tradePriorities: string[];
}

const statLabels: Partial<Record<keyof ItemStats, string>> = {
  armour: 'Local Armour',
  evasion: 'Local Evasion',
  energyShield: 'Local Energy Shield',
  life: 'Maximum Life',
  mana: 'Maximum Mana',
  spirit: 'Spirit',
  movementSpeed: 'Movement Speed',
  blockChance: 'Base Block Chance',
  increasedBlockChance: 'Increased Block Chance',
  attackSpeedBonus: 'Attack Speed',
  castSpeed: 'Cast Speed',
  spellDamage: 'Spell Damage',
  projectileSkillLevels: 'Projectile Skill Levels',
  spellSkillLevels: 'Spell Skill Levels',
  minionSkillLevels: 'Minion Skill Levels',
  criticalDamageBonus: 'Critical Damage Bonus',
  strength: 'Strength',
  charmSlots: 'Charm Slots',
};

const n = (key: keyof ItemStats, min = 0): CategoryRule => ({
  label: statLabels[key] || String(key),
  test: (item) => Number(item[key] || 0) > min,
});
const rx = (label: string, pattern: RegExp): CategoryRule => ({ label, test: (_item, text) => pattern.test(text) });
const defence = [n('armour'), n('evasion'), n('energyShield')];
const anyDefence: CategoryRule = {
  label: 'Local defence matching the base',
  test: (item) => Boolean(item.armour || item.evasion || item.energyShield),
};
const life = n('life');
const resist = rx('Resistance coverage', /Resistance/i);
const attrs = rx('Useful attributes', /Strength|Dexterity|Intelligence|all Attributes/i);
const defensiveWeapon = rx(
  'Defensive modifier consuming an offensive weapon slot',
  /maximum Life|Resistance|increased Armour|increased Evasion|increased Energy Shield/i,
);
const weaponDamage = rx(
  'Local weapon damage',
  /Physical Damage:|Fire Damage:|Cold Damage:|Lightning Damage:|Chaos Damage:|increased Physical Damage|Adds .* Damage/i,
);
const attackSpeed = rx('Attack speed', /Attacks per Second|increased Attack Speed/i);
const crit = rx('Critical scaling', /Critical/i);
const accuracy = rx('Accuracy', /Accuracy/i);
const skill = rx('Relevant skill modifiers', /level of all|Skills? (?:deal|have|gain)|Grants Skill/i);

const make = (
  key: ItemCategory,
  label: string,
  priorities: string[],
  important: CategoryRule[],
  secondary: CategoryRule[],
  weak: CategoryRule[],
  market: CategoryRule[],
  build: CategoryRule[],
  tradePriorities: string[],
): CategoryKnowledge => ({
  info: { key, label, priorities },
  important,
  secondary,
  weak,
  market,
  build,
  tradePriorities,
});

export const categoryKnowledge: Record<ItemCategory, CategoryKnowledge> = {
  'body-armour': make(
    'body-armour',
    'Body Armour',
    [
      'High local defence matching the base',
      'Life or Energy Shield identity',
      'Spirit/build-enabling modifiers',
      'Resistance or specialised utility',
    ],
    [anyDefence],
    [life, n('spirit'), resist, attrs],
    [rx('Low-impact offensive modifier on a defensive slot', /Accuracy|Attack Speed|Cast Speed/i)],
    [...defence, life, n('spirit'), resist],
    [...defence, life, n('spirit'), skill],
    [
      'Same Body Armour base or defence family',
      'Comparable local Armour/Evasion/Energy Shield',
      'Life or Spirit when present',
      'Similar item level and rarity',
    ],
  ),
  helmet: make(
    'helmet',
    'Helmet',
    [
      'Life or Energy Shield',
      'Local defence matching the build',
      'Resistances and attributes',
      'Skill or resource utility',
    ],
    [life, anyDefence],
    [resist, attrs, n('mana'), n('spirit'), skill],
    [],
    [life, ...defence, resist, skill],
    [life, ...defence, n('mana'), n('spirit'), skill],
    ['Same Helmet base', 'Local defence minimum', 'Life and resistance package', 'Build-specific skill modifier'],
  ),
  gloves: make(
    'gloves',
    'Gloves',
    [
      'Attack/cast speed or flat damage',
      'Life and resistances',
      'Accuracy or critical utility',
      'Useful local defence',
    ],
    [rx('Offensive glove modifier', /Attack Speed|Cast Speed|Adds .* Damage to Attacks/i), life],
    [resist, accuracy, crit, ...defence, attrs],
    [],
    [rx('Attack/cast speed or flat damage', /Attack Speed|Cast Speed|Adds .* Damage/i), life, resist],
    [rx('Build damage synergy', /Attack Speed|Cast Speed|Damage|Accuracy|Critical/i), life, resist],
    [
      'Same Gloves base or defence family',
      'Attack/cast speed or flat attack damage',
      'Life and resistances',
      'Accuracy/critical modifiers when relevant',
    ],
  ),
  boots: make(
    'boots',
    'Boots',
    ['Movement speed first', 'Life or Energy Shield', 'Resistance coverage', 'Build-matching local defence'],
    [n('movementSpeed', 0)],
    [life, resist, ...defence, attrs],
    [],
    [n('movementSpeed'), life, resist],
    [n('movementSpeed'), life, resist, ...defence],
    ['Same Boots base', 'Movement speed minimum first', 'Life and resistances', 'Comparable local defence'],
  ),
  shield: make(
    'shield',
    'Shield',
    ['Base block chance', 'Increased block chance', 'High local shield defence', 'Life, resistances or shield utility'],
    [n('blockChance', 0), anyDefence],
    [n('increasedBlockChance'), life, resist, skill],
    [],
    [n('blockChance'), n('increasedBlockChance'), ...defence, life],
    [n('blockChance'), ...defence, life, resist, skill],
    [
      'Shield category only',
      'Base and increased block chance',
      'Local Armour/Evasion/Energy Shield',
      'Life/resistance or shield-specific utility',
    ],
  ),
  focus: make(
    'focus',
    'Focus',
    ['Energy Shield', 'Spell or minion skill levels', 'Spell/cast/critical scaling', 'Mana and resource utility'],
    [n('energyShield'), rx('Caster or minion power', /Spell Damage|Cast Speed|level of all .*Skills|Minion/i)],
    [n('mana'), n('spirit'), crit],
    [rx('Attack-only modifier on caster off-hand', /Damage to Attacks|Attack Speed|Accuracy/i)],
    [n('energyShield'), n('spellSkillLevels'), n('minionSkillLevels'), n('spellDamage'), n('castSpeed')],
    [n('energyShield'), n('mana'), n('spirit'), skill],
    [
      'Focus category only',
      'Energy Shield minimum',
      'Relevant skill levels',
      'Spell damage/cast speed/critical utility',
    ],
  ),
  quiver: make(
    'quiver',
    'Quiver',
    [
      'Projectile skill levels or added damage',
      'Attack speed and critical scaling',
      'Accuracy/projectile utility',
      'Useful attributes',
    ],
    [rx('Projectile offensive power', /Projectile|Bow|Adds .* Damage to Attacks/i)],
    [n('attackSpeedBonus'), n('criticalDamageBonus'), accuracy, attrs],
    [defensiveWeapon],
    [n('projectileSkillLevels'), rx('Added attack damage', /Adds .* Damage to Attacks/i), n('attackSpeedBonus'), crit],
    [skill, rx('Projectile/bow synergy', /Projectile|Bow|Attack Speed|Critical|Accuracy/i), attrs],
    [
      'Quiver category only',
      'Projectile levels or added attack damage',
      'Attack speed/critical/accuracy',
      'No defensive-stat matching',
    ],
  ),
  bow: weapon(
    'bow',
    'Bow',
    ['Weapon DPS', 'Attack speed', 'Projectile modifiers', 'Critical and accuracy'],
    [rx('Projectile/bow utility', /Projectile|Arrow|Bow/i)],
  ),
  crossbow: weapon(
    'crossbow',
    'Crossbow',
    ['Weapon DPS', 'Attack speed or reload utility', 'Grenade/projectile modifiers', 'Critical and accuracy'],
    [rx('Grenade/reload/projectile utility', /Grenade|Reload|Projectile/i)],
  ),
  'one-handed-melee': weapon(
    'one-handed-melee',
    'One-handed Melee Weapon',
    ['One-handed weapon DPS', 'Attack speed', 'Critical/accuracy', 'Melee skill synergy'],
    [rx('One-handed/melee utility', /Melee|Stun|Rage|Leech/i)],
  ),
  'two-handed-melee': weapon(
    'two-handed-melee',
    'Two-handed Melee Weapon',
    ['Two-handed weapon DPS', 'Large local damage rolls', 'Attack speed', 'Critical/melee utility'],
    [rx('Two-handed/melee utility', /Melee|Stun|Rage|Leech/i)],
  ),
  staff: make(
    'staff',
    'Staff',
    ['Spell/minion skill levels', 'Spell damage', 'Cast speed', 'Critical or resource scaling'],
    [rx('Caster staff power', /Spell Damage|Cast Speed|level of all .*Skills|Minion/i)],
    [crit, n('mana'), n('spirit'), skill],
    [defensiveWeapon],
    [n('spellSkillLevels'), n('minionSkillLevels'), n('spellDamage'), n('castSpeed')],
    [skill, n('mana'), n('spirit'), crit],
    ['Staff category only', 'Relevant skill levels', 'Spell damage and cast speed', 'Critical/resource modifiers'],
  ),
  quarterstaff: weapon(
    'quarterstaff',
    'Quarterstaff',
    ['Quarterstaff DPS', 'Local physical/elemental damage', 'Attack speed', 'Critical/melee skill synergy'],
    [rx('Quarterstaff/melee utility', /Melee|Elemental|Power Charge|Stun/i)],
  ),
  wand: make(
    'wand',
    'Wand',
    ['Relevant spell/minion levels', 'Spell damage', 'Cast speed', 'Critical/resource scaling'],
    [rx('Wand caster power', /Spell Damage|Cast Speed|level of all .*Skills|Minion/i)],
    [crit, n('mana'), n('spirit'), skill],
    [defensiveWeapon],
    [n('spellSkillLevels'), n('minionSkillLevels'), n('spellDamage'), n('castSpeed')],
    [skill, n('mana'), n('spirit'), crit],
    ['Wand category only', 'Relevant skill levels', 'Spell damage and cast speed', 'Critical/resource utility'],
  ),
  sceptre: make(
    'sceptre',
    'Sceptre',
    ['Spirit or granted skill', 'Relevant skill/minion levels', 'Ally/minion scaling', 'Resource utility'],
    [n('spirit'), rx('Sceptre build power', /Grants Skill|level of all .*Skills|Minion|Ally/i)],
    [n('mana'), crit, skill],
    [defensiveWeapon],
    [n('spirit'), n('minionSkillLevels'), skill],
    [n('spirit'), skill, n('mana')],
    [
      'Sceptre category only',
      'Spirit/granted skill',
      'Relevant skill or minion modifiers',
      'Build-specific ally/resource utility',
    ],
  ),
  ring: accessory(
    'ring',
    'Ring',
    ['Resistance and attribute gaps', 'Life or mana', 'Build-specific damage/speed', 'Rarity/resource utility'],
    [
      resist,
      attrs,
      life,
      n('mana'),
      rx('Offensive ring modifier', /Damage to Attacks|Attack Speed|Cast Speed|Critical/i),
    ],
  ),
  amulet: accessory(
    'amulet',
    'Amulet',
    ['Relevant skill levels', 'Spirit or attributes', 'Life and resistance gaps', 'Critical/build scaling'],
    [skill, n('spirit'), attrs, life, resist, crit],
  ),
  belt: accessory(
    'belt',
    'Belt',
    ['Life and resistances', 'Strength or defence', 'Charm/flask utility', 'Build-specific sustain'],
    [life, resist, n('strength'), n('charmSlots'), rx('Charm/flask utility', /Charm|Flask/i)],
  ),
  other: make(
    'other',
    'Other Item',
    ['Recognised build-enabling modifiers', 'Coherent defensive or offensive package', 'Item level and base type'],
    [],
    [life, resist, attrs, skill],
    [],
    [],
    [skill],
    ['Exact base type', 'Rarity and item level', 'Recognised modifiers'],
  ),
};

function weapon(key: ItemCategory, label: string, priorities: string[], utility: CategoryRule[]): CategoryKnowledge {
  return make(
    key,
    label,
    priorities,
    [weaponDamage, attackSpeed],
    [crit, accuracy, skill, ...utility],
    [defensiveWeapon],
    [weaponDamage, attackSpeed, crit, ...utility],
    [weaponDamage, attackSpeed, crit, skill, ...utility],
    [
      `${label} category only`,
      'Displayed physical/elemental DPS',
      'Attack speed and critical chance',
      'Offensive skill/utility modifiers',
    ],
  );
}
function accessory(key: ItemCategory, label: string, priorities: string[], rules: CategoryRule[]): CategoryKnowledge {
  return make(key, label, priorities, rules.slice(0, 2), rules.slice(2), [], rules, rules, [
    'Same accessory category and base type',
    'Life/resistance/attribute totals',
    'Build-enabling damage, Spirit or resource modifiers',
    'Similar item level and rarity',
  ]);
}

export function getCategoryKnowledge(key: ItemCategory) {
  return categoryKnowledge[key];
}
