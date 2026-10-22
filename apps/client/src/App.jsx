import React, { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const PublicSite = lazy(() => import('./public/PublicSite.jsx'));
const MerchantApp = lazy(() => import('./MerchantApp.jsx'));
export function App() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="route-loading" role="status">
          {t('common.loading')}
        </div>
      }
    >
      <Routes>
        {['/', '/about', '/how-it-works', '/roadmap'].map((path) => (
          <Route key={path} path={path} element={<PublicSite />} />
        ))}
        <Route path="*" element={<MerchantApp />} />
      </Routes>
    </Suspense>
  );
}
