import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgePage } from './KnowledgePage';

let versions: any[] = [];

beforeEach(() => {
  versions = [
    {
      id: 1,
      dataset: 'modifiers',
      patch: 'any',
      dataVersion: 'seed-1',
      source: 'derived',
      status: 'active',
      entryCount: 20,
      regression: { passed: true, matchedFixtures: 0, totalFixtures: 0, issues: [] },
      compare: { addedIds: [], removedIds: [], unchangedCount: 0 },
      createdAt: '2026-01-01T00:00:00.000Z',
      activatedAt: '2026-01-01T00:00:00.000Z',
      deprecatedAt: null,
    },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      const method = options?.method || 'GET';
      if (url.endsWith('/api/admin/knowledge-status'))
        return {
          ok: true,
          status: 200,
          json: async () => ({
            patches: [],
            sources: [],
            counts: { itemBases: 0, modifiers: 20, modifierGroups: 5, craftingRules: 0, skills: 0 },
            generatedAt: '2026-01-01T00:00:00.000Z',
          }),
        };
      if (url === '/api/admin/patch/versions') return { ok: true, status: 200, json: async () => ({ versions }) };
      if (url === '/api/admin/patch/stage' && method === 'POST') {
        const body = JSON.parse(String(options?.body));
        const staged = {
          id: 2,
          dataset: 'modifiers',
          patch: body.patch,
          dataVersion: body.dataVersion,
          source: body.source,
          status: 'staged',
          entryCount: body.modifiers.length,
          regression: { passed: true, matchedFixtures: 5, totalFixtures: 5, issues: [] },
          compare: { addedIds: ['life'], removedIds: [], unchangedCount: 0 },
          createdAt: '2026-01-02T00:00:00.000Z',
          activatedAt: null,
          deprecatedAt: null,
        };
        versions = [...versions, staged];
        return { ok: true, status: 201, json: async () => ({ version: staged }) };
      }
      if (/\/api\/admin\/patch\/\d+\/activate$/.test(url) && method === 'POST') {
        const id = Number(url.match(/patch\/(\d+)\/activate/)![1]);
        versions = versions.map((v) =>
          v.id === id ? { ...v, status: 'active' } : v.status === 'active' ? { ...v, status: 'deprecated' } : v,
        );
        return { ok: true, status: 200, json: async () => ({ version: versions.find((v) => v.id === id) }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }),
  );
});

describe('knowledge page patch updater', () => {
  it('stages a new modifier patch and shows its regression and diff results', async () => {
    const user = userEvent.setup();
    render(<KnowledgePage />);
    expect(await screen.findByText(/Modifier catalog patch updater/i)).toBeInTheDocument();
    expect(await screen.findByText(/any · seed-1/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('0.6.0'), { target: { value: '0.6.0' } });
    fireEvent.change(screen.getByPlaceholderText('candidate-1'), { target: { value: 'candidate-1' } });
    fireEvent.change(screen.getByPlaceholderText(/community-submitted/i), { target: { value: 'community-test' } });
    fireEvent.change(screen.getByPlaceholderText(/"id":"life"/), {
      target: {
        value:
          '[{"id":"life","group":"MaximumLife","type":"prefix","local":false,"hybrid":false,"tags":["life"],"statKeys":["life"],"pattern":"to maximum Life","flags":"i","label":"Maximum Life","validClasses":[]}]',
      },
    });
    await user.click(screen.getByRole('button', { name: /Stage patch/i }));

    expect(await screen.findByText(/0\.6\.0 · candidate-1/i)).toBeInTheDocument();
    expect(screen.getByText(/Passed \(5\/5\)/i)).toBeInTheDocument();
    expect(screen.getByText(/\+1 \/ -0/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Activate$/i }));
    expect(await screen.findAllByText('active')).not.toHaveLength(0);
  });
});
