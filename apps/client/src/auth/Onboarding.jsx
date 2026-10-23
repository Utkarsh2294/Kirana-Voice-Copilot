import { useReadScreen } from '../voice/useSpeak.js';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Volume2, MapPin, Check } from 'lucide-react';
import { languages } from '@kirana/shared/languages';
import {
  languageStepSchema,
  storeStepSchema,
  locationStepSchema,
  upiStepSchema,
} from '@kirana/shared/merchant';
import { Button, ListenButton } from '../components/primitives.jsx';
import { usePreferences } from '../preferences.js';
import { api } from '../api.js';
import { useSession } from './Session.jsx';
import { useSpeak } from './useSpeak.js';
import AuthLayout, { AuthError } from './AuthLayout.jsx';

const keys = ['language', 'store', 'location', 'upi'];
const schemas = [languageStepSchema, storeStepSchema, locationStepSchema, upiStepSchema];

export default function Onboarding() {
  const { t, i18n } = useTranslation('auth');
  const { merchant, setMerchant, logout } = useSession();
  const { update } = usePreferences();
  const navigate = useNavigate();
  const [step, setStep] = useState(merchant.onboardingStep === 4 ? 0 : merchant.onboardingStep);
  const [draft, setDraft] = useState({
    uiLanguage: merchant.uiLanguage,
    voiceLanguage: merchant.voiceLanguage,
    voicePreference: merchant.voicePreference,
    storeName: merchant.storeName || '',
    ownerName: merchant.ownerName || '',
    pincode: merchant.location?.pincode || '',
    vpa: merchant.upi?.vpa || '',
    displayName: merchant.upi?.displayName || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [region, setRegion] = useState(null);
  const [located, setLocated] = useState(false);
  const [qr, setQr] = useState(merchant.upi?.qrImageDataUrl || '');
  const { speak, preview } = useSpeak();
  const speech = ({ lang }) =>
    import('../voice/readback.js').then(
      (module) =>
        module.buildSetupReadback({ step, lang }) +
        (step === 0 ? `. ${languages.map((item) => item.name).join(', ')}` : ''),
    );
  useReadScreen(speech);
  const heading = useRef(null);
  useEffect(() => heading.current?.focus(), [step]);
  const set = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  function body() {
    if (step === 0)
      return {
        uiLanguage: draft.uiLanguage,
        voiceLanguage: draft.voiceLanguage,
        voicePreference: draft.voicePreference,
      };
    if (step === 1) return { storeName: draft.storeName, ownerName: draft.ownerName };
    if (step === 2)
      return {
        pincode: draft.pincode,
        ...(draft.coarseLat === undefined
          ? {}
          : { coarseLat: draft.coarseLat, coarseLng: draft.coarseLng }),
      };
    return { vpa: draft.vpa, displayName: draft.displayName };
  }
  async function save(event) {
    event.preventDefault();
    setError('');
    const result = schemas[step].safeParse(body());
    if (!result.success) {
      setError('VALIDATION_FAILED');
      return;
    }
    setBusy(true);
    try {
      const result = await api(`/merchants/me/${keys[step]}`, {
        method: 'PUT',
        body: schemas[step].parse(body()),
      });
      setMerchant(result.merchant);
      if (step === 0) update({ language: result.merchant.uiLanguage });
      if (step === 3) navigate('/bill', { replace: true });
      else setStep(step + 1);
    } catch (error) {
      setError(error.code);
    } finally {
      setBusy(false);
    }
  }
  async function lookup() {
    setBusy(true);
    setError('');
    try {
      setRegion(await api(`/regions/pincode?pincode=${encodeURIComponent(draft.pincode)}`));
    } catch (error) {
      setError(error.code);
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    setBusy(true);
    setError('');
    if (!navigator.geolocation) {
      setError('PINCODE_NOT_FOUND');
      setBusy(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const coarseLat = Math.round(coords.latitude * 100) / 100;
        const coarseLng = Math.round(coords.longitude * 100) / 100;
        try {
          const result = await api(`/regions/suggest?lat=${coarseLat}&lng=${coarseLng}`);
          setDraft((previous) => ({
            ...previous,
            pincode: result.location.pincode,
            coarseLat,
            coarseLng,
          }));
          setRegion(result);
          setLocated(true);
        } catch (error) {
          setError(error.code);
        } finally {
          setBusy(false);
        }
      },
      () => {
        setError('PINCODE_NOT_FOUND');
        setBusy(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 300 * 1024) {
      setError('INVALID_QR_IMAGE');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(Object.assign(new Error(), { code: 'INVALID_QR_IMAGE' }));
        reader.readAsDataURL(file);
      });
      const result = await api('/merchants/me/qr', { method: 'POST', body: { imageDataUrl } });
      setQr(result.merchant.upi.qrImageDataUrl);
      setMerchant(result.merchant);
    } catch (error) {
      setError(error.code);
    } finally {
      setBusy(false);
    }
  }
  const steps = t('steps', { returnObjects: true });
  const count = (value) => new Intl.NumberFormat(i18n.language).format(value);
  return (
    <AuthLayout>
      <div className="auth-step-header">
        <p className="eyebrow">{t('step', { current: count(step + 1), total: count(4) })}</p>
        <Button variant="quiet" onClick={() => logout().catch((error) => setError(error.code))}>
          {t('signOut')}
        </Button>
      </div>
      <ol className="auth-step-progress" aria-label={t('setupTitle')}>
        {steps.map((name, index) => (
          <li key={name} aria-current={step === index ? 'step' : undefined}>
            <span>{index < step ? <Check size={13} aria-hidden="true" /> : count(index + 1)}</span>
            <small>{name}</small>
          </li>
        ))}
      </ol>
      <h2 ref={heading} tabIndex={-1}>
        {t(`${keys[step]}Title`)}
      </h2>
      <p>{t(`${keys[step]}Body`)}</p>
      <ListenButton label={t('listen')} getText={speech} />
      {preview && (
        <p className="auth-speech-note" role="status">
          {preview}
        </p>
      )}
      <form onSubmit={save}>
        {step === 0 && (
          <>
            <fieldset className="auth-language-grid">
              <legend>{t('uiLanguage')}</legend>
              {languages.map((language) => (
                <div key={language.code}>
                  <label>
                    <input
                      type="radio"
                      name="uiLanguage"
                      value={language.code}
                      checked={draft.uiLanguage === language.code}
                      onChange={() => {
                        set('uiLanguage', language.code);
                        update({ language: language.code });
                      }}
                    />
                    <span lang={language.code}>{language.name}</span>
                  </label>
                  <button
                    type="button"
                    aria-label={t('previewLanguage', { language: language.name })}
                    onClick={() =>
                      speak(
                        () =>
                          import('../voice/readback.js').then(
                            (module) => module.voiceGreetings[language.code],
                          ),
                        { lang: language.code },
                      )
                    }
                  >
                    <Volume2 size={17} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </fieldset>
            <label className="auth-field">
              {t('voiceLanguage')}
              <select
                value={draft.voiceLanguage}
                onChange={(event) => set('voiceLanguage', event.target.value)}
              >
                {languages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="auth-field">
              {t('voice')}
              <select
                value={draft.voicePreference}
                onChange={(event) => set('voicePreference', event.target.value)}
              >
                <option value="female">{t('female')}</option>
                <option value="male">{t('male')}</option>
              </select>
            </label>
          </>
        )}
        {step === 1 &&
          ['storeName', 'ownerName'].map((key) => (
            <label key={key} className="auth-field">
              {t(key)}
              <input
                required
                maxLength={100}
                autoComplete={key === 'ownerName' ? 'name' : 'organization'}
                value={draft[key]}
                onChange={(event) => set(key, event.target.value)}
              />
            </label>
          ))}
        {step === 2 && (
          <>
            <label className="auth-field">
              {t('pincode')}
              <input
                required
                inputMode="numeric"
                autoComplete="postal-code"
                pattern="[1-9][0-9]{5}"
                maxLength={6}
                value={draft.pincode}
                onChange={(event) => {
                  setDraft((previous) => ({
                    ...previous,
                    pincode: event.target.value.replace(/\D/g, ''),
                    coarseLat: undefined,
                    coarseLng: undefined,
                  }));
                  setRegion(null);
                  setLocated(false);
                }}
              />
            </label>
            <div className="auth-secondary">
              <Button
                variant="ghost"
                disabled={busy || !/^[1-9]\d{5}$/.test(draft.pincode)}
                onClick={lookup}
              >
                {t('lookup')}
              </Button>
              <Button variant="quiet" icon={MapPin} disabled={busy} onClick={locate}>
                {t('locate')}
              </Button>
            </div>
            {region && (
              <div className="auth-region" role="status">
                {located && <p>{t('locationConfirm')}</p>}
                {region.known ? (
                  <p>
                    {region.location.district}, {region.location.state}
                  </p>
                ) : (
                  <p>{t('unknownRegion')}</p>
                )}
              </div>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <label className="auth-field">
              {t('vpa')}
              <input
                required
                autoCapitalize="none"
                spellCheck={false}
                maxLength={320}
                value={draft.vpa}
                onChange={(event) => set('vpa', event.target.value)}
              />
            </label>
            <label className="auth-field">
              {t('payee')}
              <input
                required
                maxLength={100}
                value={draft.displayName}
                onChange={(event) => set('displayName', event.target.value)}
              />
            </label>
            <label className="auth-field">
              {t('qrUpload')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={upload}
                disabled={busy}
                aria-describedby="qr-help"
              />
            </label>
            <p id="qr-help" className="auth-footnote">
              {t('qrHelp')}
            </p>
            <section className="auth-payment-preview">
              <h3>{t('previewTitle')}</h3>
              {qr ? <img src={qr} width="160" height="160" alt={t('qrAlt')} /> : <p>{t('noQr')}</p>}
              <strong>{draft.displayName}</strong>
              <span>{draft.vpa.trim().toLowerCase()}</span>
              <p>{t('noPayment')}</p>
            </section>
          </>
        )}
        <AuthError code={error} />
        <div className="auth-form-actions">
          {step > 0 && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setStep(step - 1);
                setError('');
              }}
            >
              {t('back')}
            </Button>
          )}
          <Button type="submit" variant="action" loading={busy} disabled={busy}>
            {t(step === 3 ? 'finish' : 'continue')}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
