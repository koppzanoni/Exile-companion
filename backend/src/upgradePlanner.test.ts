import { describe, expect, it } from 'vitest';
import { genericBuildFitProfile } from './buildProfiles.js';
import { compareUpgradeCandidates, planUpgradesByBudget } from './upgradePlanner.js';

const boots =
  'Item Class: Boots\nRarity: Rare\nOld Pace\nStone Greaves\nArmour: 50\n+20 to maximum Life\n10% increased Movement Speed';
const good =
  'Item Class: Boots\nRarity: Rare\nGood Pace\nStone Greaves\nArmour: 200\n+90 to maximum Life\n30% increased Movement Speed\n+30% to Fire Resistance';
const weak = 'Item Class: Boots\nRarity: Rare\nWeak Pace\nStone Greaves\nArmour: 40\n+10 to maximum Life';

describe('upgrade planner', () => {
  it('ranks candidates by measured value and rejects a downgrade', () => {
    const rows = compareUpgradeCandidates(
      [{ slot: 'Boots', itemText: boots }],
      [
        { id: 'good', slot: 'Boots', itemText: good, price: 10, currency: 'exalted' },
        { id: 'weak', slot: 'Boots', itemText: weak, price: 2, currency: 'exalted' },
      ],
      genericBuildFitProfile,
    );
    expect(rows.find((row) => row.id === 'good')!.scoreDelta).toBeGreaterThan(0);
    expect(rows.find((row) => row.id === 'weak')!.verdict).toBe('Downgrade');
  });
  it('builds a budget-safe plan without buying two items for one slot', () => {
    const plan = planUpgradesByBudget(
      [{ slot: 'Boots', itemText: boots }],
      [
        { id: 'good', slot: 'Boots', itemText: good, price: 10, currency: 'exalted' },
        { id: 'other', slot: 'Boots', itemText: good, price: 12, currency: 'exalted' },
      ],
      20,
      genericBuildFitProfile,
    );
    expect(plan.spent).toBeLessThanOrEqual(20);
    expect(plan.selected).toHaveLength(1);
    expect(plan.afterScore).toBeGreaterThan(plan.beforeScore);
  });
});
