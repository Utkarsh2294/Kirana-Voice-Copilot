import React, { createContext, lazy, Suspense, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, refreshSession, onSessionChange, setAccessToken } from '../api.js';
import { usePreferences } from '../preferences.js';

import { useVoice, closeVoice } from '../voice/control.js';
const VoiceLayer = lazy(() => import('../voice/VoiceLayer.jsx'));
const SessionContext = createContext(null);
function applyPreferences(merchant) {
  usePreferences.getState().update({
    language: merchant.uiLanguage,
    voiceLanguage: merchant.voiceLanguage,
    voicePreference: merchant.voicePreference,
    voiceMuted: merchant.settings.voiceMuted,
    voiceVolume: merchant.settings.voiceVolume,
    voicePace: merchant.settings.voicePace,
    voiceAutoDetect: merchant.settings.voiceAutoDetect,
    voiceTranscriptOptIn: merchant.settings.voiceTranscriptOptIn,
    theme: merchant.settings.theme,
    haptics: merchant.settings.haptics,
    earcons: merchant.settings.earcons,
  });
}
export function SessionProvider({ children }) {
  const { pathname } = useLocation();
  const demo = pathname.startsWith('/demo/') || pathname === '/dev/ui';
  const voiceActive = useVoice((s) => s.active);
  const [merchant, setMerchant] = useState(null);
  const [status, setStatus] = useState(demo ? 'guest' : 'loading');
  useEffect(() => () => closeVoice(true), [pathname]);
  useEffect(
    () =>
      onSessionChange((value) => {
        setMerchant(value);
        setStatus(value ? 'authenticated' : 'guest');
      }),
    [],
  );
  useEffect(() => {
    if (demo) return;
    let active = true;
    refreshSession()
      .then((session) => {
        if (active) applyPreferences(session.merchant);
      })
      .catch((error) => {
        if (active) setStatus(error.status === 401 ? 'guest' : 'unavailable');
      });
    return () => {
      active = false;
    };
  }, [demo]);
  function signedIn(session) {
    applyPreferences(session.merchant);
    setAccessToken(session.accessToken);
    setMerchant(session.merchant);
    setStatus('authenticated');
  }
  const voiceMerchantId = merchant?.id;
  useEffect(() => {
    usePreferences.setState({ voiceMerchantId });
    if (!voiceMerchantId) return;
    const controller = new AbortController();
    api('/voice/capabilities', { signal: controller.signal })
      .then((result) => useVoice.setState({ capabilities: result.languages }))
      .catch(() => {});
    return () => {
      controller.abort();
      closeVoice();
      import('../voice/speak.js')
        .then((module) => module.clearVoiceCache(voiceMerchantId))
        .catch(() => {});
    };
  }, [voiceMerchantId]);
  async function logout(all = false) {
    try {
      await api(`/auth/${all ? 'logout-all' : 'logout'}`, { method: 'POST', body: {} });
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    try {
      closeVoice();
      await import('../pricing/draft.js').then((module) => module.useDraftBill.getState().clear());
      await import('../catalog/cache.js').then((module) => module.clearCatalogCache(merchant.id));
    } catch {
      /* Revocation still completes when browser storage is unavailable. */
    }
    setAccessToken(null);
    setMerchant(null);
    setStatus('guest');
  }
  return (
    <SessionContext.Provider value={{ merchant, status, signedIn, setMerchant, logout }}>
      {children}
      {voiceActive && (
        <Suspense fallback={null}>
          <VoiceLayer />
        </Suspense>
      )}
    </SessionContext.Provider>
  );
}
export function useSession() {
  return useContext(SessionContext);
}
