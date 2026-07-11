import { describe, expect, it } from 'vitest';
import { buildLevelingSearchPlan, milestoneFor, nextMilestoneLevel, whatChangesAtNextMilestone } from './leveling.js';
import type { BuildProfile } from './types.js';

const iceShot: BuildProfile = {
  name: 'Ice Shot Deadeye', className: 'Ranger', ascendancy: 'Deadeye', mainSkill: 'Ice Shot',
  stage: 'campaign', defenceStyle: 'life-evasion', priorities: [], requiredMods: [], desiredMods: [],
};

describe('leveling search plan', () => {
  it('limits the default search to a handful of slots instead of searching everything', () => {
    const plan = buildLevelingSearchPlan(iceShot, 32, 4);
    expect(plan.length).toBeLessThanOrEqual(3);
    expect(plan[0].category).toBe('weapon.bow');
    expect(plan[0].priorities.join(' ')).toMatch(/Cold Damage/);
    for (const slot of plan) {
      const query = slot.query as any;
      expect(query.query.filters.req_filters.filters.lvl.max).toBe(32);
      expect(query.query.filters.trade_filters.filters.price.max).toBeLessThanOrEqual(4);
      expect(query.query.filters.type_filters.filters.rarity.option).toBe('rare');
    }
  });

  it('searches the given weakest slots instead of a generic stage ranking when they are provided', () => {
    const plan = buildLevelingSearchPlan(iceShot, 32, 4, { weakestSlots: ['helmet', 'belt'] });
    expect(plan.map((p) => p.slot)).toEqual(['weapon', 'helmet', 'belt']);
  });

  it('raises the boot movement target as the character levels', () => {
    const low = buildLevelingSearchPlan(iceShot, 12, 2).find((entry) => entry.slot === 'boots')!.query as any;
    const high = buildLevelingSearchPlan(iceShot, 55, 2).find((entry) => entry.slot === 'boots')!.query as any;
    const movement = (query: any) => query.query.stats[0].filters.find((filter: any) => filter.id === 'explicit.stat_2250533757').value.min;
    expect(movement(low)).toBe(10);
    expect(movement(high)).toBe(20);
  });
});

describe('progression milestones', () => {
  it('derives the current milestone and the next one from level', () => {
    expect(milestoneFor(15)).toBe('10');
    expect(milestoneFor(35)).toBe('30');
    expect(milestoneFor(62)).toBe('advanced-campaign');
    expect(nextMilestoneLevel(15)).toBe(20);
    expect(nextMilestoneLevel(62)).toBe(65);
  });

  it('explains what changes at the next milestone instead of reusing endgame text for every stage', () => {
    const early = whatChangesAtNextMilestone(15);
    const late = whatChangesAtNextMilestone(62);
    expect(early).not.toBe(late);
    expect(early).toMatch(/20/);
  });
});
