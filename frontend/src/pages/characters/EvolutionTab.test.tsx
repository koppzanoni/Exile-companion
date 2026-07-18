import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EvolutionTab } from './EvolutionTab';

const baseProps = {
  purchaseHistory: null,
  reversePurchase: vi.fn(),
  evolutionFilters: { patch: '', from: '', to: '' },
  setEvolutionFilters: vi.fn(),
  evolution: null,
  filterEvolution: vi.fn(),
  evolutionCsvUrl: '/api/characters/1/evolution.csv',
  netCosts: null,
  saleDrafts: [],
  listSaleDraft: vi.fn(),
  alerts: [],
  markAlertRead: vi.fn(),
  calibration: null,
};

describe('EvolutionTab', () => {
  it('always renders the dashboard filters/export section', () => {
    render(<EvolutionTab {...baseProps} />);
    expect(screen.getByText('Dashboard filters and export')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('href', '/api/characters/1/evolution.csv');
  });

  it('shows unread alerts and marks one read', async () => {
    const user = userEvent.setup();
    const markAlertRead = vi.fn();
    render(
      <EvolutionTab
        {...baseProps}
        alerts={[{ id: 5, type: 'price', severity: 'info', message: 'Price dropped', createdAt: '2026-01-01' }]}
        markAlertRead={markAlertRead}
      />,
    );
    expect(screen.getByText('Price dropped')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark read' }));
    expect(markAlertRead).toHaveBeenCalledWith(5);
  });

  it('offers to reverse an unreversed purchase', async () => {
    const user = userEvent.setup();
    const reversePurchase = vi.fn();
    render(
      <EvolutionTab
        {...baseProps}
        purchaseHistory={{
          purchases: [
            {
              id: 9,
              planItemId: 1,
              slot: 'Boots',
              price: 10,
              currency: 'exalted',
              scoreBefore: 50,
              scoreAfter: 60,
              createdAt: '2026-01-01',
            },
          ],
          totalSpent: 10,
          totalScoreGain: 10,
          costPerScore: 1,
        }}
        reversePurchase={reversePurchase}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Reverse safely' }));
    expect(reversePurchase).toHaveBeenCalledWith(9);
  });
});
