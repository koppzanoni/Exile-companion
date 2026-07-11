import type { ItemStats, Rarity } from './types.js';

const number = (text: string, re: RegExp) => {
  const match = text.match(re);
  return match ? Number(match[1]) : undefined;
};

const sumMatches = (text: string, regexes: RegExp[]) => {
  const values = regexes.map((r) => number(text, r)).filter((v): v is number => v !== undefined);
  return values.length ? Math.max(...values) : undefined;
};

const damageRange = (text: string, label: string) => {
  const match = text.match(new RegExp(`^${label} Damage:\\s*(\\d+(?:\\.\\d+)?)-(\\d+(?:\\.\\d+)?)`, 'im'));
  return match ? [Number(match[1]), Number(match[2])] as const : [];
};

export function parseItemText(rawText: string): Partial<ItemStats> {
  const text = rawText.replace(/\r/g, '').trim();
  if (!text) return {};
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const rarityLine = lines.find((line) => /^Rarity:/i.test(line));
  const rarity = (rarityLine?.split(':')[1]?.trim().toLowerCase() || 'unknown') as Rarity;
  const rarityIndex = rarityLine ? lines.indexOf(rarityLine) : -1;
  const separator = lines.indexOf('--------');
  const identity = lines.slice(rarityIndex + 1, separator > rarityIndex ? separator : rarityIndex + 3);
  const name = rarity === 'rare' || rarity === 'unique' ? identity[0] : undefined;
  const baseType = (rarity === 'rare' || rarity === 'unique' ? identity[1] : identity[0]) || '';
  const lowerBase = baseType.toLowerCase();
  const itemClass = lines.find((line) => /^Item Class:/i.test(line))?.split(':').slice(1).join(':').trim() || '';
  const itemType = inferItemType(lowerBase, itemClass);
  const [physicalDamageMin, physicalDamageMax] = damageRange(text, 'Physical');
  const [fireDamageMin, fireDamageMax] = damageRange(text, 'Fire');
  const [coldDamageMin, coldDamageMax] = damageRange(text, 'Cold');
  const [lightningDamageMin, lightningDamageMax] = damageRange(text, 'Lightning');
  const [chaosDamageMin, chaosDamageMax] = damageRange(text, 'Chaos');

  const parsed: Partial<ItemStats> = {
    rawText,
    itemClass,
    rarity,
    name,
    baseType,
    itemType,
    itemLevel: number(text, /Item Level:\s*(\d+)/i),
    requiredLevel: number(text, /(?:Requires:\s*)?Level:?\s*(\d+)/i),
    requiredStrength: number(text, /Requires:[^\n]*?(\d+)(?:\s*\([^)]*\))?\s*Str\b/i) ?? number(text, /^Str:\s*(\d+)/im),
    requiredDexterity: number(text, /Requires:[^\n]*?(\d+)(?:\s*\([^)]*\))?\s*Dex\b/i) ?? number(text, /^Dex:\s*(\d+)/im),
    requiredIntelligence: number(text, /Requires:[^\n]*?(\d+)(?:\s*\([^)]*\))?\s*Int\b/i) ?? number(text, /^Int:\s*(\d+)/im),
    quality: number(text, /Quality:\s*\+?(\d+)%/i),
    corrupted: /^Corrupted$/im.test(text),
    sanctified: /^Sanctified$/im.test(text),
    energyShield: number(text, /Energy Shield:\s*(\d+)/i),
    evasion: number(text, /Evasion Rating:\s*(\d+)/i),
    armour: number(text, /Armour:\s*(\d+)/i),
    deflection: number(text, /Deflection:\s*(\d+)/i),
    runicWard: number(text, /Runic Ward:\s*(\d+)/i),
    life: sumMatches(text, [/\+(\d+)(?:\([^)]*\))?\s+to maximum Life/i, /(\d+)(?:\([^)]*\))?% increased maximum Life/i]),
    mana: sumMatches(text, [/\+(\d+)(?:\([^)]*\))?\s+to maximum Mana/i, /(\d+)(?:\([^)]*\))?% increased maximum Mana/i]),
    intelligence: sumMatches(text, [/\+(\d+)(?:\([^)]*\))?\s+to Intelligence/i, /\+(\d+)(?:\([^)]*\))?\s+to all Attributes/i]),
    strength: sumMatches(text, [/\+(\d+)(?:\([^)]*\))?\s+to Strength/i, /\+(\d+)(?:\([^)]*\))?\s+to all Attributes/i]),
    dexterity: sumMatches(text, [/\+(\d+)(?:\([^)]*\))?\s+to Dexterity/i, /\+(\d+)(?:\([^)]*\))?\s+to all Attributes/i]),
    fireResistance: number(text, /\+(\d+)(?:\([^)]*\))?% to Fire Resistance/i),
    coldResistance: number(text, /\+(\d+)(?:\([^)]*\))?% to Cold Resistance/i),
    lightningResistance: number(text, /\+(\d+)(?:\([^)]*\))?% to Lightning Resistance/i),
    chaosResistance: number(text, /\+(\d+)(?:\([^)]*\))?% to Chaos Resistance/i),
    movementSpeed: number(text, /(\d+)(?:\([^)]*\))?% increased Movement Speed/i),
    rarityFind: number(text, /(\d+)(?:\([^)]*\))?% increased Rarity of Items found/i),
    spirit: sumMatches(text, [/\+(\d+)(?:\([^)]*\))?\s+to Spirit/i, /(\d+)(?:\([^)]*\))?% increased Spirit/i]),
    stunThreshold: number(text, /(\d+)(?:\([^)]*\))?% increased Stun Threshold/i),
    physicalDamageMin,
    physicalDamageMax,
    fireDamageMin,
    fireDamageMax,
    coldDamageMin,
    coldDamageMax,
    lightningDamageMin,
    lightningDamageMax,
    chaosDamageMin,
    chaosDamageMax,
    attacksPerSecond: number(text, /Attacks per Second:\s*(\d+(?:\.\d+)?)/i),
    criticalHitChance: number(text, /Critical Hit Chance:\s*(\d+(?:\.\d+)?)%/i),
    blockChance: number(text, /Chance to Block:\s*(\d+(?:\.\d+)?)%/i),
    increasedBlockChance: number(text, /(\d+)(?:\([^)]*\))?% increased Chance to Block/i),
    attackSpeedBonus: number(text, /(\d+)(?:\([^)]*\))?% increased Attack Speed/i),
    castSpeed: number(text, /(\d+)(?:\([^)]*\))?% increased Cast Speed/i),
    spellDamage: number(text, /(\d+)(?:\([^)]*\))?% increased Spell Damage/i),
    criticalDamageBonus: number(text, /(\d+)(?:\([^)]*\))?% increased Critical Damage Bonus/i),
    projectileSkillLevels: number(text, /\+(\d+)(?:\([^)]*\))? to Level of all Projectile Skills/i),
    meleeSkillLevels: number(text, /\+(\d+)(?:\([^)]*\))? to Level of all Melee Skills/i),
    spellSkillLevels: number(text, /\+(\d+)(?:\([^)]*\))? to Level of all (?:Spell|Elemental Spell) Skills/i),
    minionSkillLevels: number(text, /\+(\d+)(?:\([^)]*\))? to Level of all Minion Skills/i),
    lifeRegeneration: number(text, /Regenerate (\d+(?:\.\d+)?) Life per second/i),
    manaRegeneration: number(text, /(\d+)(?:\([^)]*\))?% increased Mana Regeneration Rate/i),
    flaskChargesGained: number(text, /(\d+)(?:\([^)]*\))?% increased (?:Flask|Life Flask|Mana Flask) Charges gained/i),
    reducedFlaskChargesUsed: number(text, /(\d+)(?:\([^)]*\))?% reduced Flask Charges used/i),
    charmSlots: number(text, /(?:Has|Grants?)\s+(\d+) Charm Slots?/i),
    customMods: extractMods(lines),
  };
  parsed.parsedLines = buildParsedLineDebug(lines, parsed);
  return parsed;
}

function buildParsedLineDebug(lines:string[],item:Partial<ItemStats>) {
  const mappings:Array<{pattern:RegExp;fields:Array<keyof ItemStats>}>= [
    {pattern:/^Item Class:/i,fields:['itemClass','itemType']},{pattern:/^Rarity:/i,fields:['rarity']},{pattern:/^Item Level:/i,fields:['itemLevel']},{pattern:/^(?:Requires:\s*)?Level:/i,fields:['requiredLevel']},{pattern:/^Quality:/i,fields:['quality']},
    {pattern:/^Armour:/i,fields:['armour']},{pattern:/^Evasion Rating:/i,fields:['evasion']},{pattern:/^Energy Shield:/i,fields:['energyShield']},{pattern:/^Deflection:/i,fields:['deflection']},{pattern:/^Runic Ward:/i,fields:['runicWard']},{pattern:/^Chance to Block:/i,fields:['blockChance']},
    {pattern:/^Physical Damage:/i,fields:['physicalDamageMin','physicalDamageMax']},{pattern:/^Fire Damage:/i,fields:['fireDamageMin','fireDamageMax']},{pattern:/^Cold Damage:/i,fields:['coldDamageMin','coldDamageMax']},{pattern:/^Lightning Damage:/i,fields:['lightningDamageMin','lightningDamageMax']},{pattern:/^Chaos Damage:/i,fields:['chaosDamageMin','chaosDamageMax']},
    {pattern:/^Attacks per Second:/i,fields:['attacksPerSecond']},{pattern:/^Critical Hit Chance:/i,fields:['criticalHitChance']},{pattern:/maximum Life/i,fields:['life']},{pattern:/maximum Mana/i,fields:['mana']},
    {pattern:/Fire Resistance/i,fields:['fireResistance']},{pattern:/Cold Resistance/i,fields:['coldResistance']},{pattern:/Lightning Resistance/i,fields:['lightningResistance']},{pattern:/Chaos Resistance/i,fields:['chaosResistance']},
    {pattern:/Movement Speed/i,fields:['movementSpeed']},{pattern:/\bSpirit\b/i,fields:['spirit']},{pattern:/Attack Speed/i,fields:['attackSpeedBonus']},{pattern:/Cast Speed/i,fields:['castSpeed']},{pattern:/Spell Damage/i,fields:['spellDamage']},
    {pattern:/Projectile Skills/i,fields:['projectileSkillLevels']},{pattern:/Melee Skills/i,fields:['meleeSkillLevels']},{pattern:/Spell Skills/i,fields:['spellSkillLevels']},{pattern:/Minion Skills/i,fields:['minionSkillLevels']},{pattern:/Chance to Block/i,fields:['increasedBlockChance']},
    {pattern:/\bStrength\b|all Attributes/i,fields:['strength']},{pattern:/\bDexterity\b|all Attributes/i,fields:['dexterity']},{pattern:/\bIntelligence\b|all Attributes/i,fields:['intelligence']},{pattern:/Charm Slots?/i,fields:['charmSlots']},{pattern:/Flask Charges gained/i,fields:['flaskChargesGained']},{pattern:/Flask Charges used/i,fields:['reducedFlaskChargesUsed']},
  ];
  const debug=[] as NonNullable<ItemStats['parsedLines']>;
  for(const line of lines){const mapping=mappings.find((entry)=>entry.pattern.test(line));if(!mapping)continue;const fields=mapping.fields.filter((field)=>item[field]!==undefined);if(!fields.length)continue;debug.push({line,fields:fields.map(String),values:fields.map((field)=>item[field] as string|number|boolean)});}
  if(item.baseType)debug.push({line:item.baseType,fields:['baseType'],values:[item.baseType]});
  return debug;
}

function inferItemType(base: string, itemClass = '') {
  const normalizedClass = itemClass.toLowerCase();
  if (/boots/.test(normalizedClass)) return 'Boots';
  if (/helmets?/.test(normalizedClass)) return 'Helmet';
  if (/gloves?/.test(normalizedClass)) return 'Gloves';
  if (/body armours?/.test(normalizedClass)) return 'Body Armour';
  if (/rings?/.test(normalizedClass)) return 'Ring';
  if (/amulets?/.test(normalizedClass)) return 'Amulet';
  if (/belts?/.test(normalizedClass)) return 'Belt';
  if (/quivers?/.test(normalizedClass)) return 'Quiver';
  if (/focus(?:es)?|foci/.test(normalizedClass)) return 'Focus';
  if (/shields?/.test(normalizedClass)) return 'Shield';
  if (/weapons?|bows?|staves|wands?|sceptres?|crossbows?/.test(normalizedClass)) return 'Weapon';
  if (/boots|greaves|shoes|slippers|treads|sabaton/.test(base)) return 'Boots';
  if (/helmet|helm|hood|crown|cap|mask/.test(base)) return 'Helmet';
  if (/gloves|gauntlets|mitts|wraps/.test(base)) return 'Gloves';
  if (/body armour|robe|vest|plate|mail|garb/.test(base)) return 'Body Armour';
  if (/ring/.test(base)) return 'Ring';
  if (/amulet|talisman/.test(base)) return 'Amulet';
  if (/belt|sash/.test(base)) return 'Belt';
  if (/quiver/.test(base)) return 'Quiver';
  if (/focus/.test(base)) return 'Focus';
  if (/shield|buckler/.test(base)) return 'Shield';
  if (/bow|staff|mace|sword|axe|wand|sceptre|dagger|crossbow|quarterstaff/.test(base)) return 'Weapon';
  return 'Other';
}

function extractMods(lines: string[]) {
  const knownMeta = /^(Rarity:|Item Class:|Quality:|Armour:|Evasion Rating:|Energy Shield:|Deflection:|Runic Ward:|Physical Damage:|Fire Damage:|Cold Damage:|Lightning Damage:|Chaos Damage:|Critical Hit Chance:|Attacks per Second:|Reload Time:|Level:|Str:|Dex:|Int:|Item Level:|Sockets:|Requirements:|Requires:|Note:|--------$)/i;
  const modLike = /[+%]|increased|reduced|gain|adds|resistance|spirit|life|mana|damage|attack|cast|critical|accuracy|projectile|skills?|leech/i;
  return [...new Set(lines.filter((line) => !knownMeta.test(line) && modLike.test(line) && !/^\{/.test(line)))];
}

export function mergeItem(parsed: Partial<ItemStats>, manual: Partial<ItemStats>): ItemStats {
  const compact = Object.fromEntries(Object.entries(manual).filter(([, value]) => value !== '' && value !== undefined && value !== null));
  return {
    itemType: '', baseType: '',
    ...parsed,
    ...compact,
    rarity: (compact.rarity || parsed.rarity || 'unknown') as Rarity,
    customMods: Array.isArray(compact.customMods) && compact.customMods.length ? compact.customMods as string[] : parsed.customMods || [],
  } as ItemStats;
}
