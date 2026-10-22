import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, refreshSession, onSessionChange, setAccessToken } from '../api.js';
import { usePreferences } from '../preferences.js';

const SessionContext = createContext(null);
function applyPreferences(merchant) {
  usePreferences.getState().update({
    language: merchant.uiLanguage,
    theme: merchant.settings.theme,
    haptics: merchant.settings.haptics,
    earcons: merchant.settings.earcons,
  });
}
export function SessionProvider({ children }) {
  const { pathname } = useLocation();
  const demo = pathname.startsWith('/demo/') || pathname.startsWith('/dev/');
  const [merchant, setMerchant] = useState(null);
  const [status, setStatus] = useState(demo ? 'guest' : 'loading');
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
  async function logout(all = false) {
    try {
      await api(`/auth/${all ? 'logout-all' : 'logout'}`, { method: 'POST', body: {} });
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    setAccessToken(null);
    setMerchant(null);
    setStatus('guest');
  }
  return (
    <SessionContext.Provider value={{ merchant, status, signedIn, setMerchant, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  return useContext(SessionContext);
}
