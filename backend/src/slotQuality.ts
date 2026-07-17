import type { BuildFit, ItemCategoryInfo, ItemEvaluation, ItemStats } from './types.js';
export { detectItemCategory } from './categoryDetection.js';

export function evaluateSpecialSlot(item: ItemStats, category: ItemCategoryInfo): ItemEvaluation | null {
  if (category.key === 'shield') return evaluateShield(item);
  if (category.key === 'focus') return evaluateFocus(item);
  if (category.key === 'quiver') return evaluateQuiver(item);
  if (['body-armour', 'helmet', 'gloves', 'ring', 'amulet', 'belt'].includes(category.key))
    return evaluateGearSlot(item, category);
  return null;
}

function evaluateGearSlot(item: ItemStats, category: ItemCategoryInfo): ItemEvaluation {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const upgrades: string[] = [];
  const mods = modText(item);
  let score = rarityScore(item);
  const life = item.life || 0;
  const es = item.energyShield || 0;
  const armour = item.armour || 0;
  const evasion = item.evasion || 0;
  const elemental = (item.fireResistance || 0) + (item.coldResistance || 0) + (item.lightningResistance || 0);
  const totalRes = elemental + (item.chaosResistance || 0);
  const attrs = (item.strength || 0) + (item.dexterity || 0) + (item.intelligence || 0);

  if (category.key === 'body-armour') {
    const deflection = item.deflection || 0;
    const weighted = Math.max(armour, evasion, es * 4, deflection, armour + evasion, armour + es * 3, evasion + es * 3);
    if (weighted >= 1800) {
      score += 36;
      strengths.push(`Exceptional body-armour defence (${defenceText(item)})`);
    } else if (weighted >= 1000) {
      score += 29;
      strengths.push(`High body-armour defence (${defenceText(item)})`);
    } else if (weighted >= 600) {
      score += 20;
      strengths.push(`Solid body-armour defence (${defenceText(item)})`);
    } else {
      score += weighted ? 8 : 0;
      weaknesses.push('Low base defence for a Body Armour');
      upgrades.push('A substantially higher local defence roll');
    }
    if (life >= 100) {
      score += 18;
      strengths.push(`Excellent life (+${life})`);
    } else if (life >= 70) {
      score += 12;
      strengths.push(`High life (+${life})`);
    } else if (!es) {
      weaknesses.push('No strong life or Energy Shield identity');
      upgrades.push('High life or Energy Shield');
    }
    if ((item.spirit || 0) > 0 || /spirit|level of all|maximum resistance|damage taken/i.test(mods)) {
      score += 14;
      strengths.push('Build-enabling body-armour modifier');
    }
    if (totalRes >= 50) {
      score += 8;
      strengths.push(`Useful resistance package (+${totalRes}%)`);
    }
  } else if (category.key === 'helmet') {
    score += scoreDefence(item, strengths, weaknesses, upgrades, 520, 200, 95);
    score += scoreLifeRes(item, strengths, weaknesses, upgrades, 24);
    if ((item.chaosResistance || 0) >= 15) {
      score += 8;
      strengths.push(`Valuable chaos resistance (+${item.chaosResistance}%)`);
    }
    if (
      [item.fireResistance, item.coldResistance, item.lightningResistance, item.chaosResistance].filter(
        (value) => (value || 0) > 0,
      ).length >= 2
    )
      score += 5;
    if (
      item.spellSkillLevels ||
      0 ||
      item.minionSkillLevels ||
      0 ||
      item.meleeSkillLevels ||
      0 ||
      /level of all .*skills/i.test(mods)
    ) {
      score += 18;
      strengths.push('Relevant skill-level modifier');
    }
    if ((item.mana || 0) >= 60) {
      score += 6;
      strengths.push(`Useful mana (+${item.mana})`);
    }
  } else if (category.key === 'gloves') {
    score += scoreLifeRes(item, strengths, weaknesses, upgrades, 24);
    score += scoreDefence(item, strengths, weaknesses, upgrades, 420, 180, 85);
    if ((item.attackSpeedBonus || 0) > 0) {
      score += 15;
      strengths.push(`${item.attackSpeedBonus}% increased Attack Speed`);
    }
    if ((item.castSpeed || 0) > 0) {
      score += 15;
      strengths.push(`${item.castSpeed}% increased Cast Speed`);
    }
    if (/Adds .* Damage to Attacks|critical|accuracy|skill speed|damage with/i.test(mods)) {
      score += 12;
      strengths.push('Offensive glove modifier');
    }
    if (
      !(item.attackSpeedBonus || item.castSpeed) &&
      !/Adds .* Damage to Attacks|critical|accuracy|skill speed|damage with/i.test(mods)
    )
      upgrades.push('Attack/cast speed or build-specific offensive utility');
  } else if (category.key === 'ring') {
    if (totalRes >= 80) {
      score += 28;
      strengths.push(`Excellent resistance coverage (+${totalRes}%)`);
    } else if (totalRes >= 45) {
      score += 19;
      strengths.push(`Strong resistance coverage (+${totalRes}%)`);
    } else if (totalRes > 0) {
      score += 8;
      strengths.push(`Some resistance coverage (+${totalRes}%)`);
    } else {
      weaknesses.push('No resistance coverage');
      upgrades.push('Strong resistances that close character gaps');
    }
    if (life >= 70) {
      score += 15;
      strengths.push(`High life (+${life})`);
    } else if (life > 0) score += 7;
    if ((item.mana || 0) >= 60) {
      score += 9;
      strengths.push(`Strong mana (+${item.mana})`);
    }
    if (attrs >= 40) {
      score += 12;
      strengths.push(`Strong attributes (+${attrs})`);
    } else if (attrs > 0) score += 5;
    if (/Adds .* Damage to Attacks|cast speed|attack speed|critical|rarity/i.test(mods)) {
      score += 13;
      strengths.push('Build-specific offensive/utility modifier');
    }
  } else if (category.key === 'amulet') {
    const levels =
      (item.spellSkillLevels || 0) +
      (item.minionSkillLevels || 0) +
      (item.meleeSkillLevels || 0) +
      (item.projectileSkillLevels || 0);
    if (levels >= 2 || /\+2 to Level of/i.test(mods)) {
      score += 30;
      strengths.push('Premium +2 skill levels');
    } else if (levels > 0 || /\+1 to Level of/i.test(mods)) {
      score += 20;
      strengths.push('Relevant skill level');
    } else {
      weaknesses.push('No high-impact skill-level modifier');
      upgrades.push('Relevant skill levels or another build multiplier');
    }
    if ((item.spirit || 0) >= 30) {
      score += 18;
      strengths.push(`Build-enabling Spirit (+${item.spirit})`);
    } else if ((item.spirit || 0) > 0) score += 10;
    if (attrs >= 60) {
      score += 15;
      strengths.push(`Excellent attributes (+${attrs})`);
    } else if (attrs >= 30) score += 8;
    score += scoreLifeRes(item, strengths, weaknesses, upgrades, 18);
    if (/critical|damage|reservation|skill speed/i.test(mods)) {
      score += 10;
      strengths.push('Build-specific scaling');
    }
  } else if (category.key === 'belt') {
    score += scoreLifeRes(item, strengths, weaknesses, upgrades, 32);
    if ((item.strength || 0) >= 35) {
      score += 10;
      strengths.push(`Strong Strength (+${item.strength})`);
    }
    if ((item.charmSlots || 0) > 0) {
      score += Math.min(18, (item.charmSlots || 0) * 8);
      strengths.push(`${item.charmSlots} Charm slot${item.charmSlots === 1 ? '' : 's'}`);
    }
    if ((item.flaskChargesGained || 0) > 0 || (item.reducedFlaskChargesUsed || 0) > 0 || /flask|charm/i.test(mods)) {
      score += 14;
      strengths.push('Charm/flask sustain utility');
    }
    if (!item.charmSlots && !/flask|charm/i.test(mods)) upgrades.push('Charm slots or flask sustain utility');
  }
  if (!upgrades.length) upgrades.push(category.priorities[0]);
  return finish(
    item,
    score,
    strengths,
    weaknesses,
    upgrades,
    genericFits(item, category, mods),
    `${category.label} scoring focuses on ${category.priorities.slice(0, 3).join(', ').toLowerCase()}.`,
  );
}

function evaluateShield(item: ItemStats): ItemEvaluation {
  const mods = modText(item);
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const upgrades: string[] = [];
  let score = rarityScore(item);
  const block = item.blockChance || 0;
  if (block >= 30) {
    score += 25;
    strengths.push(`Excellent ${block}% base block chance`);
  } else if (block >= 25) {
    score += 20;
    strengths.push(`Strong ${block}% base block chance`);
  } else if (block >= 20) {
    score += 13;
    strengths.push(`Usable ${block}% base block chance`);
    upgrades.push('25%+ base block chance');
  } else {
    weaknesses.push(block ? `Low base block chance (${block}%)` : 'Block chance could not be read');
    upgrades.push('A higher-block shield base');
  }
  if ((item.increasedBlockChance || 0) >= 20) {
    score += 12;
    strengths.push(`${item.increasedBlockChance}% increased block chance`);
  } else if ((item.increasedBlockChance || 0) > 0) score += 6;
  const defence = shieldDefence(item);
  score += defence.score;
  if (defence.label) strengths.push(defence.label);
  else {
    weaknesses.push('Low shield defence for the slot');
    upgrades.push('Higher Armour, Evasion or Energy Shield');
  }
  score += defensivePackage(item, strengths, weaknesses, upgrades, 16);
  if (/spell damage|attack damage|level of all|minion|critical/i.test(mods)) {
    score += 8;
    strengths.push('Build-relevant offensive or skill modifier');
  }
  if (!upgrades.length) upgrades.push('Higher block, defence, or a build-enabling suffix');
  return finish(
    item,
    score,
    strengths,
    weaknesses,
    upgrades,
    shieldFits(item, block, mods),
    'A shield is judged first by block and its local defence; offensive mods only help after that foundation.',
  );
}

function evaluateFocus(item: ItemStats): ItemEvaluation {
  const mods = modText(item);
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const upgrades: string[] = [];
  let score = rarityScore(item);
  const es = item.energyShield || 0;
  const runicWard = item.runicWard || 0;
  if (es >= 250) {
    score += 25;
    strengths.push(`Excellent Focus Energy Shield (${es})`);
  } else if (es >= 150) {
    score += 18;
    strengths.push(`Strong Focus Energy Shield (${es})`);
  } else if (es >= 80) {
    score += 10;
    strengths.push(`Usable Energy Shield (${es})`);
  } else if (!runicWard) {
    weaknesses.push('Low Energy Shield for a Focus');
    upgrades.push('150+ Energy Shield');
  }
  if (runicWard >= 150) {
    score += 20;
    strengths.push(`Strong Runic Ward (${runicWard})`);
  } else if (runicWard > 0) {
    score += 10;
    strengths.push(`Runic Ward (${runicWard})`);
  }
  if ((item.spellSkillLevels || 0) > 0 || (item.minionSkillLevels || 0) > 0) {
    score += 24;
    strengths.push('Premium relevant skill levels');
  }
  if ((item.spellDamage || 0) >= 60) {
    score += 18;
    strengths.push(`${item.spellDamage}% increased Spell Damage`);
  } else if ((item.spellDamage || 0) > 0) {
    score += 10;
    strengths.push('Spell damage');
  }
  if ((item.castSpeed || 0) > 0) {
    score += 12;
    strengths.push(`${item.castSpeed}% increased Cast Speed`);
  }
  if (/critical/i.test(mods)) {
    score += 7;
    strengths.push('Caster critical scaling');
  }
  if ((item.mana || 0) > 0 || (item.manaRegeneration || 0) > 0) {
    score += 6;
    strengths.push('Mana sustain');
  }
  if (!(item.spellSkillLevels || item.minionSkillLevels || item.spellDamage || item.castSpeed)) {
    weaknesses.push('No strong caster or minion power modifier');
    upgrades.push('Skill levels, spell damage, or cast speed');
  }
  if (!upgrades.length) upgrades.push('Higher Energy Shield or another relevant caster multiplier');
  return finish(
    item,
    score,
    strengths,
    weaknesses,
    upgrades,
    focusFits(item, mods),
    'A Focus is a caster off-hand: Energy Shield and relevant caster/minion power matter more than generic armour stats.',
  );
}

function evaluateQuiver(item: ItemStats): ItemEvaluation {
  const mods = modText(item);
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const upgrades: string[] = [];
  let score = rarityScore(item);
  if ((item.projectileSkillLevels || 0) >= 2) {
    score += 27;
    strengths.push(`+${item.projectileSkillLevels} projectile skill levels`);
  } else if ((item.projectileSkillLevels || 0) > 0) {
    score += 17;
    strengths.push('Projectile skill level');
  }
  const flat = /Adds \d+(?:\([^)]*\))? to \d+(?:\([^)]*\))? (?:Physical|Fire|Cold|Lightning) Damage to Attacks/i.test(
    mods,
  );
  if (flat) {
    score += 20;
    strengths.push('Flat damage to attacks');
  }
  if (/bow damage|projectile damage/i.test(mods)) {
    score += 13;
    strengths.push('Bow/projectile damage scaling');
  }
  if ((item.attackSpeedBonus || 0) > 0) {
    score += 13;
    strengths.push(`${item.attackSpeedBonus}% increased Attack Speed`);
  }
  if ((item.criticalDamageBonus || 0) > 0 || /critical/i.test(mods)) {
    score += 10;
    strengths.push('Critical scaling');
  }
  if (/projectile speed|additional (?:arrow|projectile)/i.test(mods)) {
    score += 10;
    strengths.push('Projectile utility');
  }
  if (!flat && !item.projectileSkillLevels && !/bow damage|projectile damage/i.test(mods)) {
    weaknesses.push('No primary projectile damage prefix');
    upgrades.push('Projectile levels, flat attack damage, or bow damage');
  }
  if (!item.attackSpeedBonus && !/critical|projectile speed/i.test(mods))
    upgrades.push('Attack speed, critical scaling, or projectile speed');
  return finish(
    item,
    score,
    strengths,
    weaknesses,
    upgrades,
    quiverFits(item, mods),
    'A Quiver is an offensive bow slot; defensive affixes do not substitute for projectile levels, flat damage, speed, or critical scaling.',
  );
}

function scoreLifeRes(item: ItemStats, strengths: string[], weaknesses: string[], upgrades: string[], max: number) {
  let score = 0;
  const life = item.life || 0;
  const res =
    (item.fireResistance || 0) +
    (item.coldResistance || 0) +
    (item.lightningResistance || 0) +
    (item.chaosResistance || 0);
  if (life >= 80) {
    score += Math.min(14, max);
    strengths.push(`High life (+${life})`);
  } else if (life >= 50) {
    score += 8;
    strengths.push(`Useful life (+${life})`);
  }
  if (res >= 70) {
    score += Math.min(14, max - score);
    strengths.push(`Strong resistances (+${res}%)`);
  } else if (res >= 35) {
    score += Math.min(8, max - score);
    strengths.push(`Useful resistances (+${res}%)`);
  }
  if (!life && !res) {
    weaknesses.push('No life or resistance package');
    upgrades.push('Life or resistance coverage');
  }
  return score;
}
function scoreDefence(
  item: ItemStats,
  strengths: string[],
  weaknesses: string[],
  upgrades: string[],
  high: number,
  mid: number,
  esMid: number,
) {
  const best = Math.max(
    item.armour || 0,
    item.evasion || 0,
    (item.energyShield || 0) * 2,
    item.deflection || 0,
    (item.runicWard || 0) * 2,
  );
  if (best >= high) {
    strengths.push(`High local defence (${defenceText(item)})`);
    return 14;
  }
  if (best >= mid || (item.energyShield || 0) >= esMid) {
    strengths.push(`Useful local defence (${defenceText(item)})`);
    return 8;
  }
  if (best > 0) return 3;
  weaknesses.push('No meaningful local defence');
  upgrades.push('Higher build-matching base defence');
  return 0;
}
function genericFits(item: ItemStats, category: ItemCategoryInfo, mods: string): BuildFit[] {
  const defence = Math.min(
    100,
    (item.life || 0) / 2 +
      (item.armour || 0) / 20 +
      (item.evasion || 0) / 20 +
      (item.energyShield || 0) / 2 +
      (item.deflection || 0) / 20 +
      (item.runicWard || 0) / 2,
  );
  const utility = Math.min(
    100,
    (item.spirit || 0) + (item.mana || 0) / 2 + (/level of|skill|flask|charm/i.test(mods) ? 35 : 0),
  );
  const offence = Math.min(
    100,
    (item.attackSpeedBonus || 0) * 2 + (item.castSpeed || 0) * 2 + (/damage|critical|level of/i.test(mods) ? 45 : 0),
  );
  return makeFits([
    ['Defensive ' + category.label, defence, ['life', 'resistances', 'local defence']],
    ['Build-enabling ' + category.label, utility, ['skill levels', 'Spirit/resource utility']],
    ['Offensive ' + category.label, offence, ['speed', 'damage/critical scaling']],
  ]);
}

function defensivePackage(item: ItemStats, strengths: string[], weaknesses: string[], upgrades: string[], max: number) {
  let score = 0;
  const life = item.life || 0;
  const res =
    (item.fireResistance || 0) +
    (item.coldResistance || 0) +
    (item.lightningResistance || 0) +
    (item.chaosResistance || 0);
  if (life >= 70) {
    score += Math.min(10, max);
    strengths.push(`High life (+${life})`);
  } else if (life > 0) {
    score += 4;
  }
  if (res >= 70) {
    score += Math.min(10, max - score);
    strengths.push(`Strong resistances (+${res}%)`);
  } else if (res >= 35) {
    score += 5;
    strengths.push(`Useful resistance (${res}%)`);
  }
  if (!life && !res) {
    weaknesses.push('No life or resistance package');
    upgrades.push('Life or strong resistance coverage');
  }
  return score;
}
function shieldDefence(item: ItemStats) {
  const best = Math.max(item.armour || 0, item.evasion || 0, (item.energyShield || 0) * 3, item.deflection || 0);
  if (best >= 900) return { score: 20, label: `Excellent shield defence (${defenceText(item)})` };
  if (best >= 500) return { score: 14, label: `Strong shield defence (${defenceText(item)})` };
  if (best >= 220) return { score: 7, label: `Usable shield defence (${defenceText(item)})` };
  return { score: 0, label: '' };
}
function defenceText(item: ItemStats) {
  return [
    `${item.armour || 0} Armour`,
    `${item.evasion || 0} Evasion`,
    `${item.energyShield || 0} ES`,
    `${item.deflection || 0} Deflection`,
    `${item.runicWard || 0} Runic Ward`,
  ]
    .filter((x) => !x.startsWith('0 '))
    .join(', ');
}
function finish(
  item: ItemStats,
  raw: number,
  strengths: string[],
  weaknesses: string[],
  upgrades: string[],
  buildFits: BuildFit[],
  explanation: string,
): ItemEvaluation {
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const grade =
    score >= 88 ? 'elite' : score >= 74 ? 'excellent' : score >= 55 ? 'good' : score >= 34 ? 'basic' : 'poor';
  const label =
    grade === 'elite'
      ? 'Elite endgame item'
      : grade === 'excellent'
        ? 'Excellent endgame item'
        : grade === 'good'
          ? 'Good, build-usable item'
          : grade === 'basic'
            ? 'Usable but replaceable'
            : 'Low-value / early upgrade';
  const marketability = score >= 74 && buildFits[0]?.score >= 68 ? 'broad' : score >= 45 ? 'niche' : 'low';
  return {
    score,
    grade,
    label,
    verdict: `${explanation} This ${item.itemType || 'item'} is ${grade === 'basic' ? 'usable but replaceable' : grade}.`,
    marketability,
    strengths: unique(strengths).slice(0, 6),
    weaknesses: unique(weaknesses).slice(0, 5),
    upgradePriorities: unique(upgrades).slice(0, 4),
    buildFits: buildFits.slice(0, 3),
  };
}
function shieldFits(item: ItemStats, block: number, mods: string): BuildFit[] {
  return makeFits([
    ['Block / armour defence', Math.min(100, block * 2 + (item.armour || 0) / 18), ['block chance', 'armour']],
    [
      'Energy Shield caster shield',
      Math.min(100, block + (item.energyShield || 0) / 2 + (/spell|critical/i.test(mods) ? 25 : 0)),
      ['Energy Shield', 'caster utility'],
    ],
    [
      'Hybrid defensive shield',
      Math.min(100, block + (item.armour || 0) / 30 + (item.energyShield || 0) / 4),
      ['block', 'hybrid defence'],
    ],
  ]);
}
function focusFits(item: ItemStats, mods: string): BuildFit[] {
  return makeFits([
    [
      'Spell damage caster',
      Math.min(100, (item.energyShield || 0) / 3 + (item.spellDamage || 0) / 1.5 + (item.castSpeed || 0) * 2),
      ['Energy Shield', 'spell damage', 'cast speed'],
    ],
    [
      'Critical spell caster',
      Math.min(100, (item.energyShield || 0) / 4 + (/critical/i.test(mods) ? 45 : 0) + (item.castSpeed || 0)),
      ['Energy Shield', 'critical scaling'],
    ],
    [
      'Minion / Spirit caster',
      Math.min(100, (item.energyShield || 0) / 4 + (item.minionSkillLevels || 0) * 30 + (item.spirit || 0)),
      ['Energy Shield', 'minion levels', 'Spirit'],
    ],
  ]);
}
function quiverFits(item: ItemStats, mods: string): BuildFit[] {
  return makeFits([
    [
      'Elemental projectile attack',
      Math.min(
        100,
        (item.projectileSkillLevels || 0) * 25 +
          (item.attackSpeedBonus || 0) * 2 +
          (/Fire|Cold|Lightning/i.test(mods) ? 35 : 0),
      ),
      ['projectile levels', 'attack speed', 'elemental damage'],
    ],
    [
      'Physical projectile attack',
      Math.min(
        100,
        (item.projectileSkillLevels || 0) * 25 +
          (item.attackSpeedBonus || 0) * 2 +
          (/Physical|bow damage/i.test(mods) ? 35 : 0),
      ),
      ['projectile levels', 'attack speed', 'physical damage'],
    ],
    [
      'Critical projectile attack',
      Math.min(
        100,
        (item.projectileSkillLevels || 0) * 20 + (item.criticalDamageBonus || 0) + (/critical/i.test(mods) ? 35 : 0),
      ),
      ['projectile levels', 'critical scaling'],
    ],
  ]);
}
function makeFits(rows: Array<[string, number, string[]]>): BuildFit[] {
  return rows
    .map(([name, value, reasons]) => {
      const score = Math.round(value);
      return {
        name,
        score,
        fit: score >= 68 ? 'strong' : score >= 42 ? 'possible' : 'weak',
        reasons: reasons.filter(Boolean),
        conflicts: [],
      };
    })
    .sort((a, b) => b.score - a.score) as BuildFit[];
}
function rarityScore(item: ItemStats) {
  return item.rarity === 'rare' ? 8 : item.rarity === 'unique' ? 10 : 3;
}
function modText(item: ItemStats) {
  return item.customMods.length ? item.customMods.join('\n') : item.rawText || '';
}
const unique = (values: string[]) => [...new Set(values)];
