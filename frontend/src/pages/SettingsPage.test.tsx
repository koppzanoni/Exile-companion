import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { I18nProvider } from '../i18n';

let savedBody: any;
beforeEach(() => {
  savedBody = undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => {
        if (options?.method === 'PUT') {
          savedBody = JSON.parse(String(options.body));
          return savedBody;
        }
        return {
          divineToExalted: 65,
          defaultLeague: 'Standard',
          craftingRiskTolerance: 'Low',
          showCurrencyWarnings: true,
          conservativeCraftingRecommendations: true,
        };
      },
    })),
  );
});

describe('crafting settings', () => {
  it('loads and saves risk tolerance and warning controls', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <SettingsPage />
      </I18nProvider>,
    );
    const tolerance = await screen.findByLabelText('Crafting risk tolerance');
    expect(tolerance).toHaveValue('Low');
    expect(screen.getByLabelText('Currency warnings')).toBeChecked();
    fireEvent.change(tolerance, { target: { value: 'High' } });
    await user.click(screen.getByLabelText('Currency warnings'));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(savedBody.craftingRiskTolerance).toBe('High');
    expect(savedBody.showCurrencyWarnings).toBe(false);
    expect(savedBody.conservativeCraftingRecommendations).toBe(true);
  });
});
