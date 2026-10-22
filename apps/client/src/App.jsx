import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shell } from './components/Shell.jsx';
import { UiProvider } from './components/overlays.jsx';
import { PageHeading, Skeleton } from './components/primitives.jsx';

const Gallery = import.meta.env.DEV ? lazy(() => import('./pages/Gallery.jsx')) : null;
const Bill = lazy(() => import('./pages/Bill.jsx'));
function Placeholder({ name }) {
  const { t } = useTranslation();
  return (
    <section className="stack">
      <PageHeading
        eyebrow={t('prototype.badge')}
        title={t(`nav.${name}`)}
        description={t('prototype.description')}
      />
      <Skeleton lines={4} />
    </section>
  );
}

export function App() {
  const { t } = useTranslation();
  return (
    <UiProvider>
      <Shell>
        <Suspense fallback={<p>{t('common.loading')}</p>}>
          <Routes>
            <Route path="/" element={<Navigate to="/bill" replace />} />
            <Route path="/bill" element={<Bill />} />
            {['insights', 'catalog', 'customers', 'settings', 'login'].map((name) => (
              <Route key={name} path={`/${name}`} element={<Placeholder name={name} />} />
            ))}
            {Gallery && <Route path="/dev/ui" element={<Gallery />} />}
            {import.meta.env.DEV && (
              <Route path="/dev/voice" element={<Placeholder name="voice" />} />
            )}
            <Route path="*" element={<Placeholder name="notFound" />} />
          </Routes>
        </Suspense>
      </Shell>
    </UiProvider>
  );
}
