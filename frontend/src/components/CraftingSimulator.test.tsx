import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CraftingSimulator } from './CraftingSimulator';

const normalState = { itemClass: 'Boots', baseType: 'Worn Sandals', rarity: 'normal', quality: 0, corrupted: false, prefixes: [], suffixes: [], modifierGroups: [], sockets: [], currencySpent: [] };
const magicState = { ...normalState, rarity: 'magic', currencySpent: [{ currencyId: 'orb-of-transmutation', label: 'Orb of Transmutation' }] };
const legalActions = [{ currencyId: 'orb-of-transmutation', label: 'Orb of Transmutation', legal: true, reasons: [], reversible: false, outcomeCertainty: 'guaranteed', accumulatedCostCount: 0, risk: 'low', recommendedStop: false }];

let historyEntries: any[] = [];

beforeEach(() => {
  historyEntries = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method || 'GET';
    if (url.startsWith('/api/crafting/history') && method === 'GET') return { ok: true, status: 200, json: async () => ({ history: historyEntries }) };
    if (url === '/api/crafting/history' && method === 'POST') {
      historyEntries = [{ id: 1, characterId: null, action: 'Orb of Transmutation', currencySpentCount: 1, valueBefore: 5, valueAfter: 8, gainLoss: 3, createdAt: '2026-07-10T00:00:00.000Z', nextSafeAction: 'Orb of Augmentation', risks: [] }];
      return { ok: true, status: 201, json: async () => ({ id: 1, gainLoss: 3 }) };
    }
    if (url === '/api/crafting/state') return { ok: true, status: 200, json: async () => ({ state: normalState, legalActions, currencies: [] }) };
    if (url === '/api/crafting/apply') return { ok: true, status: 200, json: async () => ({ state: magicState, evaluation: { ...legalActions[0], legal: true }, legalActions: [] }) };
    return { ok: true, status: 200, json: async () => ({}) };
  }));
});

describe('crafting simulator', () => {
  it('previews an action without saving it, then persists it only on confirm', async () => {
    const user = userEvent.setup();
    render(<CraftingSimulator itemText="Item Class: Boots\nRarity: Normal\nWorn Sandals" league="Runes of Aldur"/>);

    await user.click(screen.getByRole('button', { name: /Inspect crafting state/i }));
    expect(await screen.findByText(/Worn Sandals/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Orb of Transmutation/i }));
    expect(await screen.findByText(/PREVIEW \(not saved\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/\+3 exalted/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Confirm this action/i }));
    expect(await screen.findByText(/\+3 exalted/i)).toBeInTheDocument();
    expect(await screen.findByText(/Next safe action: Orb of Augmentation/i)).toBeInTheDocument();
  });

  it('discards a preview without persisting anything', async () => {
    const user = userEvent.setup();
    render(<CraftingSimulator itemText="Item Class: Boots\nRarity: Normal\nWorn Sandals" league="Runes of Aldur"/>);

    await user.click(screen.getByRole('button', { name: /Inspect crafting state/i }));
    await screen.findByText(/Worn Sandals/i);
    await user.click(screen.getByRole('button', { name: /Orb of Transmutation/i }));
    await screen.findByText(/PREVIEW \(not saved\)/i);

    await user.click(screen.getByRole('button', { name: /Discard preview/i }));
    expect(screen.queryByText(/PREVIEW \(not saved\)/i)).not.toBeInTheDocument();
    expect(screen.getByText(/0 currency used/i)).toBeInTheDocument();
  });
});
