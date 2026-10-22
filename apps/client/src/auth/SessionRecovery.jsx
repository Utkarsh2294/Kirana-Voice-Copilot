import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/primitives.jsx';
import './copy.js';
import './auth.css';

export default function SessionRecovery() {
  const { t } = useTranslation('auth');
  return (
    <main className="auth-recovery">
      <h1>{t('unavailableTitle')}</h1>
      <p>{t('unavailableBody')}</p>
      <Button onClick={() => window.location.reload()}>{t('retry')}</Button>
      <Link className="auth-demo-link" to="/demo/bill">
        {t('demo')}
      </Link>
    </main>
  );
}
