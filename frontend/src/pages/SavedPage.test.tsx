import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedPage } from './SavedPage';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 1,
          league: 'Standard',
          item: { name: 'Aegis Crest', rarity: 'rare' },
          dataSource: 'live',
          officialUrl: '#',
          createdAt: '2026-01-01',
          evaluation: { label: 'Excellent endgame item', score: 82 },
          result: { fair: 40 },
          recommendation: { action: 'Price Check', confidence: 'High' },
        },
      ],
    })),
  );
});

describe('saved checks', () => {
  it('shows the persisted final recommendation', async () => {
    render(<SavedPage />);
    expect(await screen.findByText('Recommendation: Price Check · High')).toBeInTheDocument();
  });

  it('labels the icon-only trade and delete actions for screen readers', async () => {
    render(<SavedPage />);
    await screen.findByText('Recommendation: Price Check · High');
    expect(screen.getByLabelText('Open official trade for Aegis Crest')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete saved check for Aegis Crest')).toBeInTheDocument();
  });
});
