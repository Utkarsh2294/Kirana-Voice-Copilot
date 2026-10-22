import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function useSpeak() {
  const { t } = useTranslation('auth');
  const [preview, setPreview] = useState('');
  function speak(text) {
    // Phase 6 replaces this explicit text preview. Do not log store or payment details.
    if (import.meta.env.DEV)
      console.warn('[useSpeak] Speech preview requested; no audio provider connected.');
    setPreview(`${t('speechNote')} ${text}`);
  }
  return { speak, preview };
}
