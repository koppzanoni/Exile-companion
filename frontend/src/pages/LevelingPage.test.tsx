import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LevelingPage } from './LevelingPage';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => {
        if (url.endsWith('/api/settings'))
          return {
            defaultLeague: 'Runes of Aldur',
            divineToExalted: 65,
            craftingRiskTolerance: 'Medium',
            showCurrencyWarnings: true,
            conservativeCraftingRecommendations: true,
          };
        return {
          profile: {
            name: 'Ice Shot Deadeye',
            className: 'Ranger',
            ascendancy: 'Deadeye',
            mainSkill: 'Ice Shot',
            stage: 'campaign',
            evaluationStyle: 'balanced',
            defenceStyle: 'life-evasion',
            priorities: [],
            requiredMods: [],
            desiredMods: [],
          },
          source: 'reader',
          provider: 'poe.ninja',
          warnings: [],
          level: 24,
          league: 'Runes of Aldur',
          maxPrice: 3,
          milestone: '20',
          nextMilestoneLevel: 30,
          whatChangesNext: 'At level 30, resistance minimums rise again.',
          slots: [
            {
              slot: 'weapon',
              label: 'Bow',
              priorities: ['Total DPS', 'Cold Damage'],
              budget: 3,
              officialUrl: 'https://www.pathofexile.com/trade2/search/poe2/test',
              listings: [
                {
                  id: 'one',
                  slot: 'weapon',
                  name: 'Frost Branch',
                  baseType: 'Recurve Bow',
                  requiredLevel: 20,
                  price: 1,
                  currency: 'exalted',
                  mods: ['Adds 10 to 20 Cold Damage'],
                  officialUrl: 'https://www.pathofexile.com/trade2/search/poe2/test',
                  verdict: 'buy-now',
                  usefulLevels: 6,
                },
              ],
            },
          ],
        };
      },
    })),
  );
});

describe('leveling page', () => {
  it('searches a guide at the entered level and renders purchasable gear', async () => {
    const user = userEvent.setup();
    render(<LevelingPage />);
    fireEvent.change(screen.getByPlaceholderText(/Paste your build link here/i), {
      target: { value: 'https://poe.ninja/poe2/pob/2370c' },
    });
    fireEvent.change(screen.getByLabelText('Character level'), { target: { value: '24' } });
    await user.click(screen.getByRole('button', { name: /Show upgrades for level/i }));
    expect(await screen.findByText('Ice Shot Deadeye')).toBeInTheDocument();
    expect(screen.getByText('Frost Branch')).toBeInTheDocument();
    expect(screen.getByText('1 Ex')).toBeInTheDocument();
    expect(screen.getByText(/Requires 20/)).toBeInTheDocument();
    expect(screen.getByText(/Buy now/i)).toBeInTheDocument();
    expect(screen.getByText(/Milestone:/)).toBeInTheDocument();
  });
});
