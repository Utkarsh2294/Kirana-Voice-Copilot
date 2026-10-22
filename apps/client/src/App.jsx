import React, { lazy, Suspense } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Gallery = import.meta.env.DEV ? lazy(() => import('./pages/Gallery.jsx')) : null;
function Placeholder({ name }) {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t(`nav.${name}`)}</h1>
      <p>{t('prototype.description')}</p>
    </main>
  );
}

export function App() {
  const { t } = useTranslation();
  return (
    <>
      <header>{t('brand.name')}</header>
      <nav>
        {['bill', 'insights', 'catalog', 'settings'].map((route) => (
          <NavLink key={route} to={`/${route}`}>
            {t(`nav.${route}`)}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<p>{t('common.loading')}</p>}>
        <Routes>
          <Route path="/" element={<Navigate to="/bill" replace />} />
          {['bill', 'insights', 'catalog', 'customers', 'settings', 'login'].map((name) => (
            <Route key={name} path={`/${name}`} element={<Placeholder name={name} />} />
          ))}
          {Gallery && <Route path="/dev/ui" element={<Gallery />} />}
          {import.meta.env.DEV && (
            <Route path="/dev/voice" element={<Placeholder name="voice" />} />
          )}
          <Route path="*" element={<Placeholder name="notFound" />} />
        </Routes>
      </Suspense>
    </>
  );
}
