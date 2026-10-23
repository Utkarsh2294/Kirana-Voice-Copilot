import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from './Session.jsx';
import { usePreferences } from '../preferences.js';
import { Button, GlassCard } from '../components/primitives.jsx';
import { fromPaise, toPaise } from '@kirana/shared/money';
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
  const [margin, setMargin] = useState(
    fromPaise(session?.merchant?.settings.targetMarginBps ?? 800),
  );
  if (!session?.merchant || pathname.startsWith('/demo/')) return null;
  async function save() {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const targetMarginBps = toPaise(margin);
      if (targetMarginBps > 10000)
        throw Object.assign(new Error('Invalid margin'), { code: 'VALIDATION_FAILED' });
      await api('/merchants/me/language', {
        method: 'PUT',
        body: {
          uiLanguage: prefs.language,
          voiceLanguage: prefs.voiceLanguage,
          voicePreference: prefs.voicePreference,
        },
      });
      const result = await api('/merchants/me', {
        method: 'PATCH',
        body: {
          settings: {
            theme: prefs.theme,
            haptics: prefs.haptics,
            earcons: prefs.earcons,
            targetMarginBps,
          },
        },
      });
      session.setMerchant(result.merchant);
      setSaved(true);
    } catch (error) {
      setError(error.code || 'VALIDATION_FAILED');
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
      <label className="auth-field">
        {t('targetMargin')}
        <input
          inputMode="decimal"
          value={margin}
          onChange={(event) => setMargin(event.target.value)}
        />
      </label>
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
