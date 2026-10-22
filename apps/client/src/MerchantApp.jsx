import React, { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell.jsx';
import { UiProvider } from './components/overlays.jsx';
import { Skeleton } from './components/primitives.jsx';

const Gallery = import.meta.env.DEV ? lazy(() => import('./pages/Gallery.jsx')) : null;
const Bill = lazy(() => import('./pages/Bill.jsx'));
const Insights = lazy(() => import('./pages/Insights.jsx'));
const Catalog = lazy(() => import('./pages/Catalog.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const ComingSoon = lazy(() => import('./pages/ComingSoon.jsx'));
const CoachMarks = lazy(() => import('./components/CoachMarks.jsx'));
export default function MerchantApp() {
  return (
    <UiProvider>
      <Shell>
        <Suspense fallback={<Skeleton lines={5} />}>
          <Routes>
            <Route path="/bill" element={<Bill />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/insights" element={<Insights />} />
            {['customers', 'login'].map((name) => (
              <Route key={name} path={`/${name}`} element={<ComingSoon name={name} />} />
            ))}
            {Gallery && <Route path="/dev/ui" element={<Gallery />} />}
            {import.meta.env.DEV && (
              <Route path="/dev/voice" element={<ComingSoon name="voice" phase={6} />} />
            )}
            <Route path="*" element={<ComingSoon name="notFound" />} />
          </Routes>
          <CoachMarks />
        </Suspense>
      </Shell>
    </UiProvider>
  );
}
