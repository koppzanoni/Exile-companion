import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UpgradesTab } from './UpgradesTab';

const actionPlan = {
  characterId: 1,
  budget: 40,
  score: 60,
  purchases: [
    {
      rank: 1,
      slot: 'Boots',
      reason: 'Movement speed gap',
      priority: 'High' as const,
      suggestedBudget: 10,
      tradeUrl: 'https://pathofexile.com/trade2/search/x',
      requiresEquippedItem: false,
    },
  ],
  blockers: [],
  warning: '',
};

describe('UpgradesTab', () => {
  it('lists shopping-plan entries and triggers a candidate search', async () => {
    const user = userEvent.setup();
    const searchCandidates = vi.fn();
    render(
      <UpgradesTab
        actionPlan={actionPlan}
        marketCandidates={null}
        shopping={[]}
        marketLoading={false}
        searchCandidates={searchCandidates}
        persistPlan={vi.fn()}
        updateShopping={vi.fn()}
        monitorItem={vi.fn()}
        equipPurchase={vi.fn()}
      />,
    );
    expect(screen.getByText(/Movement speed gap/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Find and simulate' }));
    expect(searchCandidates).toHaveBeenCalledWith('Boots');
  });

  it('lets the user discard a saved purchase-plan item', async () => {
    const user = userEvent.setup();
    const updateShopping = vi.fn();
    render(
      <UpgradesTab
        actionPlan={null}
        marketCandidates={null}
        shopping={[
          {
            id: 1,
            slot: 'Boots',
            reason: 'Movement speed gap',
            priority: 'High',
            suggestedBudget: 10,
            status: 'searching',
            updatedAt: '2026-01-01',
          },
        ]}
        marketLoading={false}
        searchCandidates={vi.fn()}
        persistPlan={vi.fn()}
        updateShopping={updateShopping}
        monitorItem={vi.fn()}
        equipPurchase={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(updateShopping).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'discarded');
  });
});
