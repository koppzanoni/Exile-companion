import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageSelector } from './components/LanguageSelector';
import { I18nProvider, translationCatalogs, translationKeys, useI18n } from './i18n';

function Probe() {
  const { locale, t, format } = useI18n();
  return (
    <div data-testid="probe">
      {locale}|{t('nav.settings')}|{format.number(1234.5)}
    </div>
  );
}

describe('internationalization', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          persisted: false,
          activeCharacterId: null,
          language: 'en',
          experienceMode: 'beginner',
          onboardingStep: 0,
          onboardingComplete: false,
        }),
      })),
    );
  });
  it('keeps English and Portuguese catalogs structurally identical', () => {
    expect(Object.keys(translationCatalogs.pt).sort()).toEqual([...translationKeys].sort());
    expect(new Set(translationKeys).size).toBe(translationKeys.length);
  });
  it('switches immediately, updates document language and persists the explicit choice', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <LanguageSelector />
        <Probe />
      </I18nProvider>,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'pt-BR');
    expect(screen.getByTestId('probe')).toHaveTextContent('pt-BR|Configurações|1.234,5');
    expect(document.documentElement.lang).toBe('pt-BR');
    expect(localStorage.getItem('exile-companion-language')).toBe('pt-BR');
  });
});
