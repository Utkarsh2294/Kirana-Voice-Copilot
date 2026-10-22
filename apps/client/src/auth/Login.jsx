import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PhoneInput, OtpInput } from '../components/PhoneControls.jsx';
import { Button } from '../components/primitives.jsx';
import { api } from '../api.js';
import { useSession } from './Session.jsx';
import AuthLayout, { AuthError } from './AuthLayout.jsx';

export default function Login() {
  const { t } = useTranslation('auth');
  const { signedIn } = useSession();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [development, setDevelopment] = useState(false);
  const [otpNotice, setOtpNotice] = useState(false);
  const controller = useRef(null);
  useEffect(() => {
    let active = true;
    api('/auth/capabilities')
      .then((result) => {
        if (active) setDevelopment(result.developmentOtp);
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, []);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (sent)
        signedIn(
          await api('/auth/otp/verify', { method: 'POST', body: { phone: `+91${phone}`, code } }),
        );
      else {
        await api('/auth/otp/request', { method: 'POST', body: { phone: `+91${phone}` } });
        setSent(true);
      }
    } catch (error) {
      setError(error.code);
    } finally {
      setBusy(false);
    }
  }
  async function webOtp() {
    controller.current?.abort();
    controller.current = new AbortController();
    const timeout = setTimeout(() => controller.current?.abort(), 60_000);
    try {
      const credential = await navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: controller.current.signal,
      });
      if (credential?.code) setCode(credential.code);
    } catch {
      setOtpNotice(true);
    } finally {
      clearTimeout(timeout);
    }
  }
  return (
    <AuthLayout>
      <p className="eyebrow">{t('eyebrow')}</p>
      <h2>{t(sent ? 'otpTitle' : 'loginTitle')}</h2>
      <p>{t(sent ? 'otpBody' : 'loginBody')}</p>
      {development && (
        <p className="auth-development" role="note">
          {t('development')}
        </p>
      )}
      <form onSubmit={submit}>
        <PhoneInput value={phone} onChange={setPhone} disabled={sent || busy} />
        {sent && <OtpInput value={code} onChange={setCode} />}
        <AuthError code={error} />
        <Button
          type="submit"
          variant="action"
          loading={busy}
          disabled={busy || (sent ? code.length !== 6 : !/^[6-9]\d{9}$/.test(phone))}
        >
          {t(sent ? 'verify' : 'sendCode')}
        </Button>
      </form>
      {sent && (
        <div className="auth-secondary">
          <Button
            variant="quiet"
            onClick={() => {
              setSent(false);
              setCode('');
              setError('');
              controller.current?.abort();
            }}
          >
            {t('changePhone')}
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError('');
              api('/auth/otp/request', { method: 'POST', body: { phone: `+91${phone}` } })
                .then(() => setCode(''))
                .catch((error) => setError(error.code))
                .finally(() => setBusy(false));
            }}
          >
            {t('resend')}
          </Button>
        </div>
      )}
      {sent && 'OTPCredential' in window && (
        <Button variant="ghost" onClick={webOtp}>
          {t('webOtp')}
        </Button>
      )}
      {otpNotice && <p role="status">{t('webOtpFailed')}</p>}
      {!development && <p className="auth-footnote">{t('smsNote')}</p>}
      <Link className="auth-demo-link" to="/demo/bill">
        {t('demo')}
      </Link>
    </AuthLayout>
  );
}
