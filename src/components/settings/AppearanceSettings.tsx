import { Moon, Sun, Languages } from 'lucide-react';
import { useResolvedTheme } from '../../hooks/useResolvedTheme';
import { t, useInterfaceLanguage } from '../../i18n';
import type { LanguagePreference } from '../../i18n/language';

export default function AppearanceSettings({ themeMode, onThemeChange }: { themeMode: 'system' | 'light' | 'dark'; onThemeChange: (mode: 'light' | 'dark') => void }) {
  const resolvedTheme = useResolvedTheme();
  const { preference, setPreference } = useInterfaceLanguage();
  const selectedTheme = themeMode === 'system' ? resolvedTheme : themeMode;
  return <div className="interface-preferences">
    <div className="settings-preference-row">
      <div className="settings-preference-label">{selectedTheme === 'dark' ? <Moon size={18}/> : <Sun size={18}/>}<span>{t('Тема')}</span></div>
      <select aria-label={t('Тема')} value={selectedTheme} onChange={event => onThemeChange(event.target.value as 'light' | 'dark')}>
        <option value="light">{t('Светлая')}</option><option value="dark">{t('Тёмная')}</option>
      </select>
    </div>
    <div className="settings-preference-row">
      <div className="settings-preference-label"><Languages size={18}/><span>{t('Язык интерфейса')}</span></div>
      <select aria-label={t('Язык интерфейса')} value={preference} onChange={event => setPreference(event.target.value as LanguagePreference)}>
        <option value="system">{t('Как в системе')}</option><option value="ru">Русский</option><option value="en">English</option>
      </select>
    </div>
  </div>;
}
