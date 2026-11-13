import { useEffect, useState } from 'react';
import type { LocalSpeechState } from '../../shared/localSpeech';

export function useLocalSpeech() {
  const [state, setState] = useState<LocalSpeechState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    window.electronAPI.getLocalSpeechState().then(value => { if (alive) setState(value); }).catch(error => { if (alive) setError(String(error.message || error)); });
    const unsubscribe = window.electronAPI.onLocalSpeechChanged(value => { if (alive) setState(value); });
    const provider = window.electronAPI.onSttProviderChanged(value => setState(before => before ? {...before, activeProvider: value} : before));
    return () => { alive = false; unsubscribe(); provider(); };
  }, []);
  return {state, error};
}
