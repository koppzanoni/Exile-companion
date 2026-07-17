import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageSelector } from './LanguageSelector';
import { I18nProvider } from '../i18n';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ persisted: false }) })),
  );
});

describe('LanguageSelector', () => {
  it('defaults to English and switches to Portuguese, persisting the choice and updating <html lang>', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <LanguageSelector />
      </I18nProvider>,
    );
    const select = screen.getByLabelText('Language');
    expect(select).toHaveValue('en');
    expect(document.documentElement.lang).toBe('en');
    await user.selectOptions(select, 'pt-BR');
    expect(select).toHaveValue('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
    expect(localStorage.getItem('exile-companion-language')).toBe('pt-BR');
  });
});
