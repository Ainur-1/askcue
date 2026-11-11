import { useState } from 'react';
import fontLicense from '../../../assets/fonts/noto-serif/OFL.txt?raw';

export function applyAppearance() {
  const font = localStorage.getItem('pika_display_font');
  document.documentElement.style.setProperty('--font-display', font === 'system' ? "'Segoe UI', system-ui, sans-serif" : "'Noto Serif', Georgia, serif");
}

export default function AppearanceSettings({ themeMode, onThemeChange }: { themeMode: 'system' | 'light' | 'dark'; onThemeChange: (mode: 'system' | 'light' | 'dark') => void }) {
  const [font, setFont] = useState(localStorage.getItem('pika_display_font') === 'system' ? 'system' : 'serif');
  return <section className="appearance-settings">
    <h3>Оформление</h3>
    <div className="appearance-options">
      <div className="text-sm text-text-secondary flex-1 min-w-32">Японская гравюра<br/><span className="text-xs">Бумага и изумрудные чернила</span></div>
      <label>Тема<select aria-label="Тема оформления" value={themeMode} onChange={event => onThemeChange(event.target.value as 'system' | 'light' | 'dark')}><option value="light">Светлая бумага</option><option value="dark">Тёмная тушь</option><option value="system">Как в системе</option></select></label>
      <label>Шрифт заголовков<select aria-label="Шрифт заголовков" value={font} onChange={event => {
        setFont(event.target.value); localStorage.setItem('pika_display_font', event.target.value); applyAppearance();
      }}><option value="serif">Noto Serif</option><option value="system">Системный</option></select></label>
    </div>
    <details className="mt-3 text-xs text-text-secondary"><summary>Лицензия шрифта</summary><pre className="whitespace-pre-wrap mt-2">{fontLicense}</pre></details>
  </section>;
}
