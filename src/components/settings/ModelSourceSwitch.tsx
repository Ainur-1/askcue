import { Monitor, Plug } from 'lucide-react';
import { t } from '../../i18n';

export function ModelSourceSwitch({value, onChange, ai = false}: {value: 'local' | 'api'; onChange: (value: 'local' | 'api') => void; ai?: boolean}) {
  return <div className="model-source-switch" role="group" aria-label={t(ai ? 'AI model source' : 'Recognition source')}>
    <button type="button" aria-pressed={value === 'local'} onClick={() => onChange('local')}><Monitor size={16}/>{t('Local models')}</button>
    <button type="button" aria-pressed={value === 'api'} onClick={() => onChange('api')}><Plug size={16}/>{t(ai ? 'API and services' : 'Via API')}</button>
  </div>;
}
