import { Languages } from 'lucide-react';
import { useI18n } from '../i18n';

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className={compact ? 'language-selector compact' : 'language-selector'}>
      <Languages aria-hidden="true" />
      <span>{t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as 'en' | 'pt-BR')}
      >
        <option value="en">{t('language.english')}</option>
        <option value="pt-BR">{t('language.portuguese')}</option>
      </select>
    </label>
  );
}
