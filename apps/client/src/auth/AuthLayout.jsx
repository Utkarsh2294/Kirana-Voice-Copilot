import React from 'react';
import { Link } from 'react-router-dom';
import { AudioLines, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../preferences.js';
import './copy.js';
import './auth.css';

export default function AuthLayout({ children }) {
  const { t } = useTranslation('auth');
  const { t: common } = useTranslation();
  const { language, update } = usePreferences();
  return (
    <div className="auth-page">
      <header>
        <Link to="/" className="auth-brand">
          <AudioLines size={28} aria-hidden="true" />
          <span>
            {common('brand.name')}
            <i>.</i>
          </span>
        </Link>
        <div>
          <Link to="/">
            <ArrowLeft size={16} aria-hidden="true" />
            {t('home')}
          </Link>
          <label>
            <span className="sr-only">{common('settings.selectLanguage')}</span>
            <select
              value={['en-IN', 'hi-IN'].includes(language) ? language : 'en-IN'}
              onChange={(event) => update({ language: event.target.value })}
            >
              <option value="en-IN">English</option>
              <option value="hi-IN">हिन्दी</option>
            </select>
          </label>
        </div>
      </header>
      <main className="auth-layout">
        <aside>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1>{t('tagline')}</h1>
          <p>{t('intro')}</p>
          <span className="auth-orbit" aria-hidden="true">
            <AudioLines size={75} strokeWidth={1} />
          </span>
        </aside>
        <div className="auth-form-panel">{children}</div>
      </main>
    </div>
  );
}
export function AuthError({ code }) {
  const { t } = useTranslation('auth');
  return code ? (
    <p className="auth-error" role="alert">
      {t(`errors.${code}`, { defaultValue: t('errors.fallback') })}
    </p>
  ) : null;
}
