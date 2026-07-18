import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesPage } from './SalesPage';
import { I18nProvider } from '../i18n';

const baseSale = {
  id: 1,
  itemName: 'Stone Greaves',
  league: 'Runes of Aldur',
  status: 'listed',
  listedPrice: 20,
  currency: 'exalted',
  finalPrice: null,
  listedAt: '2026-07-14T00:00:00Z',
};

function stubFetch(sales: Array<Record<string, unknown>>, advice: unknown[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/sales') && (!init || init.method === undefined))
        return { ok: true, status: 200, json: async () => ({ sales }) };
      if (url.endsWith('/api/sales/advice'))
        return { ok: true, status: 200, json: async () => ({ advice, basis: 'local history' }) };
      if (url.endsWith('/api/sales') && init?.method === 'POST')
        return { ok: true, status: 200, json: async () => ({ id: 2 }) };
      if (/\/api\/sales\/\d+$/.test(url) && init?.method === 'PUT')
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      throw new Error(`unexpected request: ${url} ${init?.method || 'GET'}`);
    }),
  );
}

function renderPage() {
  render(
    <I18nProvider>
      <SalesPage />
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('SalesPage', () => {
  it('lists saved sales with advice and lets the user mark one sold', async () => {
    const user = userEvent.setup();
    stubFetch(
      [baseSale],
      [
        {
          saleId: 1,
          action: 'hold',
          confidence: 'Medium',
          reasons: ['Comparable listings unchanged.'],
          suggestedPrice: null,
        },
      ],
    );
    renderPage();
    expect(await screen.findByText('Stone Greaves')).toBeInTheDocument();
    expect(screen.getByText('Hold price')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark sold' }));
    expect(await screen.findByText('Stone Greaves')).toBeInTheDocument();
  });

  it('creates a new listing from the form', async () => {
    const user = userEvent.setup();
    stubFetch([]);
    renderPage();
    await screen.findByText('New listing');
    await user.type(screen.getByLabelText('Item name'), 'Widowhail');
    const addButton = screen.getByRole('button', { name: 'Add listing' });
    expect(addButton).toBeEnabled();
    await user.click(addButton);
    expect(await screen.findByText('New listing')).toBeInTheDocument();
  });

  it('disables the add button until an item name is entered', async () => {
    stubFetch([]);
    renderPage();
    expect(screen.getByRole('button', { name: 'Add listing' })).toBeDisabled();
  });

  it('announces the loading state to assistive technology', async () => {
    let resolveSales!: (value: { ok: true; status: 200; json: () => Promise<{ sales: unknown[] }> }) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.endsWith('/api/sales'))
          return new Promise((resolve) => {
            resolveSales = resolve;
          });
        if (url.endsWith('/api/sales/advice')) return { ok: true, status: 200, json: async () => ({ advice: [] }) };
        throw new Error(`unexpected request: ${url}`);
      }),
    );
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading sales…');
    resolveSales({ ok: true, status: 200, json: async () => ({ sales: [] }) });
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });
});
