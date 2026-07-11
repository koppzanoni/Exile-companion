import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildDoctorPage } from './BuildDoctorPage';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => {
    if (url.endsWith('/api/build-profiles')) return { profiles: [{ id: 'generic-build-fit', source: 'generic', name: 'Generic Build Fit' }] };
    return {
      resistances: { current: { fireResistance: 20, coldResistance: 0, lightningResistance: 0, chaosResistance: 0 }, missing: { fireResistance: 55, coldResistance: 75, lightningResistance: 75, chaosResistance: 75 }, cap: 75 },
      attributes: { total: { strength: 0, dexterity: 30, intelligence: 0 }, required: { strength: 0, dexterity: 120, intelligence: 0 }, met: { strength: true, dexterity: false, intelligence: true } },
      spirit: { current: 0, note: 'Spirit requirement depends on active skills/gems, which are not yet tracked.' },
      defenceByType: { armour: 100, evasion: 0, energyShield: 0, deflection: 0, runicWard: 0 },
      slots: [{ slot: 'Ring 1', baseType: 'Gold Ring', overallScore: 40, weaknessRank: 40, wastedStats: [], contributions: { resistances: {}, attributes: {}, spirit: 0, defence: {} } }],
      weakestSlots: ['Ring 1'],
      wastedStatsOverall: [],
      recommendedUpgradeOrder: [{ slot: 'Ring 1', reason: 'Lowest stat-valuation score (40/100) among equipped items.', budgetPriority: 'High' }],
      alerts: [{ slot: 'Ring 1', message: 'Do not replace this Ring 1 before recovering 90 dexterity; another equipped item requires 120 dexterity and only 30 would remain.' }],
      limitations: ['Suggested budget is a relative priority (High/Medium/Low), not a currency amount, because no verified crafting/market cost model is attached to this diagnosis.'],
    };
  } })));
});

describe('build doctor page', () => {
  it('diagnoses pasted equipment and shows swap-safety alerts', async () => {
    const user = userEvent.setup(); render(<BuildDoctorPage/>);
    fireEvent.change(screen.getByLabelText('Ring 1 item text'), { target: { value: 'Item Class: Rings\nRarity: Rare\nEmber Loop\nGold Ring\n--------\nRequires: Level 60, 38 Dex\n--------\n+30 Dexterity\n+20% to Fire Resistance' } });
    await user.click(screen.getByRole('button', { name: /Diagnose build/i }));
    expect(await screen.findByText(/before recovering 90 dexterity/i)).toBeInTheDocument();
    expect(screen.getByText('Gold Ring')).toBeInTheDocument();
  });
});
