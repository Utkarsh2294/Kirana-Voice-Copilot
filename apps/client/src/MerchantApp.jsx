import React, { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Shell } from './components/Shell.jsx';
import { UiProvider } from './components/overlays.jsx';
import { Skeleton } from './components/primitives.jsx';

const VoiceHarness = import.meta.env.DEV ? lazy(() => import('./voice/VoiceHarness.jsx')) : null;
const Gallery = import.meta.env.DEV ? lazy(() => import('./pages/Gallery.jsx')) : null;
const PriceBill = lazy(() => import('./pricing/PriceBill.jsx'));
const Bill = lazy(() => import('./pages/Bill.jsx'));
const Insights = lazy(() => import('./pages/Insights.jsx'));
const Catalog = lazy(() => import('./pages/Catalog.jsx'));
const DemoCatalog = lazy(() => import('./pages/DemoCatalog.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const ComingSoon = lazy(() => import('./pages/ComingSoon.jsx'));
const CoachMarks = lazy(() => import('./components/CoachMarks.jsx'));
export default function MerchantApp() {
  const { pathname } = useLocation();
  const prefix = pathname.startsWith('/demo/') ? '/demo' : '';
  return (
    <UiProvider>
      <Shell>
        <Suspense fallback={<Skeleton lines={5} />}>
          <Routes>
            <Route path={`${prefix}/bill`} element={prefix ? <Bill /> : <PriceBill />} />
            <Route path={`${prefix}/catalog`} element={prefix ? <DemoCatalog /> : <Catalog />} />
            <Route path={`${prefix}/settings`} element={<Settings />} />
            <Route path={`${prefix}/insights`} element={<Insights />} />
            {['customers'].map((name) => (
              <Route key={name} path={`${prefix}/${name}`} element={<ComingSoon name={name} />} />
            ))}
            {Gallery && <Route path="/dev/ui" element={<Gallery />} />}
            {VoiceHarness && <Route path="/dev/voice" element={<VoiceHarness />} />}
            <Route path="*" element={<ComingSoon name="notFound" />} />
          </Routes>
          <CoachMarks />
        </Suspense>
      </Shell>
    </UiProvider>
  );
}
