import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from './Session.jsx';
import { usePreferences } from '../preferences.js';
import { Button, GlassCard } from '../components/primitives.jsx';
import { api } from '../api.js';
import { AuthError } from './AuthLayout.jsx';

export default function AccountSettings() {
  const session = useSession();
  const { pathname } = useLocation();
  const { t } = useTranslation('auth');
  const prefs = usePreferences();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!session?.merchant || pathname.startsWith('/demo/')) return null;
  async function save() {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await api('/merchants/me/language', {
        method: 'PUT',
        body: {
          uiLanguage: prefs.language,
          voiceLanguage: session.merchant.voiceLanguage,
          voicePreference: session.merchant.voicePreference,
        },
      });
      const result = await api('/merchants/me', {
        method: 'PATCH',
        body: { settings: { theme: prefs.theme, haptics: prefs.haptics, earcons: prefs.earcons } },
      });
      session.setMerchant(result.merchant);
      setSaved(true);
    } catch (error) {
      setError(error.code);
    } finally {
      setBusy(false);
    }
  }
  async function signOut(all) {
    setBusy(true);
    setError('');
    try {
      await session.logout(all);
    } catch (error) {
      setError(error.code);
    } finally {
      setBusy(false);
    }
  }
  return (
    <GlassCard className="account-settings">
      <h2>{t('accountTitle')}</h2>
      <p className="muted">{session.merchant.storeName}</p>
      <p className="muted">{t('accountBody')}</p>
      <div className="auth-secondary">
        <Button disabled={busy} onClick={save}>
          {t('savePreferences')}
        </Button>
        <Link className="button button--ghost" to="/onboarding">
          {t('editSetup')}
        </Link>
        <Button variant="quiet" disabled={busy} onClick={() => signOut(false)}>
          {t('signOut')}
        </Button>
        <Button variant="quiet" disabled={busy} onClick={() => signOut(true)}>
          {t('signOutAll')}
        </Button>
      </div>
      <AuthError code={error} />
      {saved && <p role="status">{t('preferencesSaved')}</p>}
    </GlassCard>
  );
}
