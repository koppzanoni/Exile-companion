import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { I18nProvider } from '../i18n';

const characters = [
  {
    id: 1,
    name: 'HeroOne',
    league: 'Standard',
    level: 80,
    className: 'Ranger',
    ascendancy: 'Deadeye',
    buildProfileId: 'generic-build-fit',
    stage: 'endgame',
    budget: 40,
    targetContent: 'Maps',
    currentIssues: '',
    updatedAt: '2026-07-14',
  },
  {
    id: 2,
    name: 'HeroTwo',
    league: 'Standard',
    level: 50,
    className: 'Monk',
    ascendancy: 'Invoker',
    buildProfileId: 'generic-build-fit',
    stage: 'campaign',
    budget: 10,
    targetContent: 'Campaign',
    currentIssues: '',
    updatedAt: '2026-07-14',
  },
];
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = String(input);
      let body: unknown = {};
      if (url.endsWith('/api/build-profile')) body = { profile: null };
      else if (url.endsWith('/api/preferences'))
        body = {
          persisted: false,
          activeCharacterId: null,
          language: 'en',
          experienceMode: 'beginner',
          onboardingStep: 0,
          onboardingComplete: false,
        };
      else if (url.endsWith('/api/service-status'))
        body = {
          checkedAt: '2026-07-14T12:00:00Z',
          services: {
            database: { status: 'online', source: 'local', confidence: 'High' },
            poe: { status: 'not-configured', source: 'config', confidence: 'High' },
            gemini: { status: 'configured', source: 'config', confidence: 'High' },
            trade2: { status: 'unknown', source: 'not probed', confidence: 'Low' },
          },
        };
      else if (url.endsWith('/api/characters')) body = { characters };
      else if (/\/api\/characters\/\d+$/.test(url)) {
        const id = Number(url.split('/').pop()),
          character = characters.find((row) => row.id === id)!;
        body = {
          character,
          equipment: [],
          diagnosis: {
            profile: { overallScore: id === 1 ? 72 : 45, recommendedUpgradeOrder: [] },
            recommendedUpgradeOrder: [{ slot: 'Boots', reason: 'Improve movement and life.', budgetPriority: 'High' }],
          },
          history: [],
        };
      } else if (url.includes('/shopping-plan'))
        body = {
          items: [
            {
              id: 1,
              slot: 'Boots',
              reason: 'Upgrade',
              priority: 'High',
              suggestedBudget: 10,
              status: 'searching',
              updatedAt: '2026-07-14',
            },
          ],
        };
      else if (url.endsWith('/alerts'))
        body = {
          alerts: [{ id: 1, type: 'build', severity: 'critical', message: 'Resistance gap', createdAt: '2026-07-14' }],
        };
      else if (url.endsWith('/evolution'))
        body = {
          snapshots: [
            { id: 2, patch: '0.5', score: 72, createdAt: '2026-07-14', resistances: {}, spirit: 0, defences: {} },
            { id: 1, patch: '0.5', score: 68, createdAt: '2026-07-13', resistances: {}, spirit: 0, defences: {} },
          ],
          purchases: [],
          bestPurchase: null,
          worstPurchase: null,
          currentBudget: 40,
          patches: ['0.5'],
        };
      else if (url.endsWith('/api/admin/operations'))
        return { ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) };
      return { ok: true, status: 200, json: async () => body };
    }),
  );
});

describe('dashboard active character', () => {
  it('shows daily character data and remembers the selected character', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(await screen.findByText('Upgrade Boots')).toBeInTheDocument();
    expect(screen.getByText('active recommendations')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Active character'), '2');
    expect(await screen.findByRole('heading', { name: 'HeroTwo' })).toBeInTheDocument();
    expect(localStorage.getItem('exile-companion-active-character')).toBe('2');
  });
});
