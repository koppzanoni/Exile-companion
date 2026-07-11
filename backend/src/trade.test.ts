import { describe, expect, it } from 'vitest';
import { buildTradeQuery, buildTradeUrl, dedupeListings, normalizeOfficialListing, parseTradeUrl } from './trade.js';
import type { ItemStats } from './types.js';

describe('Trade2 URL parsing', () => {
  it('round-trips generated q query and league', () => {
    const item: ItemStats = { itemType: 'Boots', baseType: 'Stone Greaves', rarity: 'rare', life: 70, movementSpeed: 25, customMods: [] };
    const url = buildTradeUrl(item, 'Runes of Aldur');
    const parsed = parseTradeUrl(url);
    expect(parsed.league).toBe('Runes of Aldur');
    expect(parsed.type).toBe('Stone Greaves');
    expect(parsed.rarity).toBe('rare');
    expect(parsed.stats.length).toBeGreaterThan(0);
    expect(parsed.sort).toEqual({ price: 'asc' });
  });

  it('uses only Trade2-supported equipment and level filter keys', () => {
    const item: ItemStats = { itemType: 'Boots', baseType: 'Stone Greaves', rarity: 'rare', itemLevel: 78, requiredLevel: 65, armour: 268, customMods: [] };
    const built = buildTradeQuery(item) as any;
    expect(built.query.filters.type_filters.filters.ilvl).toBeDefined();
    expect(built.query.filters.type_filters.filters.lvl_req).toBeUndefined();
    expect(built.query.filters.equipment_filters.filters.ar).toBeDefined();
    expect(built.query.filters.trade_filters.filters.price.option).toBe('exalted_divine');
  });

  it('builds weapon comparisons from DPS, attack speed, and critical chance instead of defences', () => {
    const item: ItemStats = { itemType: 'Weapon', baseType: 'Siege Crossbow', rarity: 'rare', physicalDamageMin: 132, physicalDamageMax: 377, attacksPerSecond: 1.65, criticalHitChance: 5, customMods: [] };
    const built = buildTradeQuery(item) as any;
    const equipment = built.query.filters.equipment_filters.filters;
    expect(equipment.pdps.min).toBeGreaterThan(300);
    expect(equipment.dps.min).toBeGreaterThan(300);
    expect(equipment.aps).toBeDefined();
    expect(equipment.crit).toBeDefined();
    expect(built.query.stats).toEqual([]);
  });

  it('builds a same-slot fallback query without pinning the exact base', () => {
    const item: ItemStats = { itemType: 'Boots', baseType: 'Stone Greaves', rarity: 'rare', itemLevel: 78, life: 76, movementSpeed: 25, customMods: [] };
    const built = buildTradeQuery(item, 'same-slot') as any;
    expect(built.query.type).toBeUndefined();
    expect(built.query.filters.type_filters.filters.category.option).toBe('armour.boots');
    expect(built.query.stats[0].filters.length).toBeGreaterThan(0);
  });

  it('keeps shields, quivers and boots in category-specific Trade2 searches',()=>{
    const shield=buildTradeQuery({itemType:'Shield',itemClass:'Shields',baseType:'Plate Shield',rarity:'rare',blockChance:26,armour:600,life:70,customMods:[]},'same-slot') as any;
    const quiver=buildTradeQuery({itemType:'Quiver',itemClass:'Quivers',baseType:'Broadhead Quiver',rarity:'rare',projectileSkillLevels:2,customMods:[]},'same-slot') as any;
    const boots=buildTradeQuery({itemType:'Boots',itemClass:'Boots',baseType:'Stone Greaves',rarity:'rare',movementSpeed:30,life:70,customMods:[]},'same-slot') as any;
    expect(shield.query.filters.type_filters.filters.category.option).toBe('armour.shield');
    expect(quiver.query.filters.type_filters.filters.category.option).toBe('armour.quiver');
    expect(quiver.query.stats).toEqual([]);
    expect(boots.query.stats[0].filters.some((filter:any)=>filter.id==='explicit.stat_2250533757')).toBe(true);
  });

  it('normalizes current Trade2 object mods and defence properties', () => {
    const listing = normalizeOfficialListing({
      id: 'official-1',
      listing: { price: { amount: 3, currency: 'exalted' }, indexed: '2026-01-01', account: { name: 'seller' } },
      item: {
        name: 'Rune Pace', typeLine: 'Stone Greaves', baseType: 'Stone Greaves', rarity: 'Rare', ilvl: 78,
        properties: [{ name: '[Armour]', values: [['268', 0]] }],
        explicitMods: [{ description: '+76 to maximum Life' }, { description: '25% increased Movement Speed' }, { description: '+31% to Fire Resistance' }],
      },
    }, 65, 'https://example.test');
    expect(listing).toMatchObject({ price: 3, currency: 'exalted', baseType: 'Stone Greaves', stats: { armour: 268, life: 76, movementSpeed: 25, fireResistance: 31 } });
  });

  it('normalizes official weapon damage properties', () => {
    const listing = normalizeOfficialListing({
      id: 'weapon-1', listing: { price: { amount: 10, currency: 'exalted' } },
      item: { name: 'Gloom Core', typeLine: 'Siege Crossbow', baseType: 'Siege Crossbow', rarity: 'Rare', properties: [
        { name: '[Physical] Damage', type: 9, values: [['132-377', 1]] },
        { name: '[ElementalDamage|Elemental] Damage', type: 10, values: [['20-40', 4], ['10-30', 5], ['2-60', 6]] },
        { name: '[Critical|Critical Hit] Chance', type: 12, values: [['5.00%', 0]] }, { name: 'Attacks per Second', type: 13, values: [['1.65', 0]] },
      ], explicitMods: ['43% increased Physical Damage'] },
    }, 65, 'https://example.test');
    expect(listing?.stats).toMatchObject({ physicalDamageMin: 132, physicalDamageMax: 377, fireDamageMin: 20, fireDamageMax: 40, coldDamageMin: 10, coldDamageMax: 30, lightningDamageMin: 2, lightningDamageMax: 60, attacksPerSecond: 1.65, criticalHitChance: 5 });
  });

  it('does not count a cached official listing more than once', () => {
    const row = { id: 'same-id', name: 'Vortex Horn', baseType: 'Ancestral Tiara', rarity: 'rare' as const, price: 1, currency: 'divine' as const, exaltedPrice: 65, stats: {}, source: 'cache' as const };
    expect(dedupeListings([row, { ...row }])).toHaveLength(1);
  });

  it('extracts an official query id when no q parameter is present', () => {
    expect(parseTradeUrl('https://www.pathofexile.com/trade2/search/poe2/Standard/abc123').queryId).toBe('abc123');
  });

  it('rejects lookalike hosts', () => {
    expect(() => parseTradeUrl('https://example.com/trade2/search/poe2/Standard')).toThrow(/pathofexile/);
  });
});
