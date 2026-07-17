import type { ItemAnalysisInput, ItemParser, NormalizedModifier } from './engineContracts.js';
import { mergeItem, parseItemText } from './itemParser.js';
import { defaultModifierCatalog, type ModifierCatalogEntry } from './modifierCatalog.js';
import { lookupModifier } from './modifierLookup.js';
import type { ItemStats } from './types.js';

export class ClipboardItemParser implements ItemParser {
  parseClipboard(text: string, context: { league?: string; patch?: string } = {}): ItemAnalysisInput {
    return buildItemAnalysis(mergeItem(parseItemText(text), {}), text, context);
  }
}

export function buildItemAnalysis(
  item: ItemStats,
  text: string,
  context: { league?: string; patch?: string } = {},
  catalog: ModifierCatalogEntry[] = defaultModifierCatalog,
): ItemAnalysisInput {
  const advanced = parseAdvancedModifiers(text).map((mod): NormalizedModifier => ({ ...mod, confidence: 'High' }));
  const knownTexts = new Set(advanced.flatMap((mod) => mod.text.split('\n')));
  const rawCandidates = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(isPossibleModifier);
  const candidates = [...(item.customMods || []), ...rawCandidates].filter(
    (line, index, all) => all.indexOf(line) === index,
  );
  const classified = candidates
    .filter((line) => !knownTexts.has(line))
    .map((line, index): NormalizedModifier => {
      const lookup = lookupModifier(catalog, line, item.itemClass || item.itemType);
      return {
        id: `${lookup.method}:${lookup.id}:${index}`,
        text: line,
        type: lookup.type,
        group: lookup.type === 'unknown' ? undefined : lookup.group,
        tags: lookup.tags,
        local: lookup.local,
        hybrid: lookup.hybrid,
        statKeys: lookup.statKeys,
        confidence: lookup.confidence,
        crafted: /crafted/i.test(line),
        desecrated: /desecrated/i.test(line),
        source: lookup.method === 'catalog' ? 'modifier-catalog' : 'regex-fallback',
      };
    });
  const implicitModifiers = [
    ...advanced.filter((mod) => mod.type === 'implicit'),
    ...classified.filter((mod) => mod.type === 'implicit'),
  ];
  const prefixes = [
    ...advanced.filter((mod) => mod.type === 'prefix'),
    ...classified.filter((mod) => mod.type === 'prefix'),
  ];
  const suffixes = [
    ...advanced.filter((mod) => mod.type === 'suffix'),
    ...classified.filter((mod) => mod.type === 'suffix'),
  ];
  const unknownModifiers = classified.filter((mod) => mod.type === 'unknown');
  return {
    game: 'poe2',
    league: context.league || '',
    patch: context.patch || '',
    itemClass: item.itemClass || item.itemType || '',
    baseType: item.baseType,
    rarity: item.rarity,
    itemLevel: item.itemLevel,
    requiredLevel: item.requiredLevel,
    quality: item.quality || 0,
    corrupted: Boolean(item.corrupted),
    identified: !/Unidentified/i.test(text),
    sockets: parseSockets(text),
    implicitModifiers,
    prefixes,
    suffixes,
    unknownModifiers,
    baseDefences: {
      armour: item.armour || 0,
      evasion: item.evasion || 0,
      energyShield: item.energyShield || 0,
      deflection: item.deflection || 0,
      runicWard: item.runicWard || 0,
    },
  };
}

function parseSockets(text: string) {
  return (
    text
      .match(/^Sockets:\s*(.+)$/im)?.[1]
      ?.trim()
      .split(/\s+/)
      .filter(Boolean) || []
  );
}
function isPossibleModifier(line: string) {
  return (
    /^(?:[+-]?\d|Adds\b|Minions?\b|Gain\b|Grants?\b|You\b|Attacks?\b|Spells?\b)/i.test(line) &&
    !/^\d+(?:\.\d+)?\s*$/.test(line)
  );
}

function parseAdvancedModifiers(text: string): NormalizedModifier[] {
  const lines = text.split(/\r?\n/);
  const result: NormalizedModifier[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(
      /^\{\s*(Desecrated\s+)?(Prefix|Suffix|Implicit) Modifier "([^"]+)" \(Tier: (\d+)\)\s*(?:â€”|—|-)?\s*([^}]*)\}/i,
    );
    if (!match) continue;
    const tags = match[5]
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const hybrid = tags.length > 1;
    const valueLineCount = hybrid ? tags.length : 1;
    const valueLines = lines
      .slice(i + 1, i + 1 + valueLineCount)
      .map((line) => line.trim())
      .filter(Boolean);
    const value = valueLines.join('\n') || (lines[i + 1] || '').trim();
    const rolls = [...value.matchAll(/(-?\d+(?:\.\d+)?)\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g)];
    const percentiles = rolls.map((roll) => {
      const actual = Number(roll[1]);
      const min = Number(roll[2]);
      const max = Number(roll[3]);
      return max === min ? 100 : Math.round(((actual - min) / (max - min)) * 100);
    });
    const firstRoll = rolls[0];
    result.push({
      id: `${match[2].toLowerCase()}:${match[3]}`,
      text: value,
      type: match[2].toLowerCase() as NormalizedModifier['type'],
      group: match[3],
      tier: Number(match[4]),
      minimumRoll: firstRoll ? Number(firstRoll[2]) : undefined,
      maximumRoll: firstRoll ? Number(firstRoll[3]) : undefined,
      actualRoll: firstRoll ? Number(firstRoll[1]) : undefined,
      rollPercentile: percentiles.length
        ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length)
        : undefined,
      tags,
      local: false,
      hybrid,
      crafted: /crafted/i.test(lines[i]),
      desecrated: Boolean(match[1]),
      source: 'advanced-clipboard',
    });
    i += Math.max(1, valueLines.length);
  }
  return result;
}
