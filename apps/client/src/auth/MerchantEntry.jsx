import React, { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './Session.jsx';
import MerchantApp from '../MerchantApp.jsx';
import { Skeleton } from '../components/primitives.jsx';

const Login = lazy(() => import('./Login.jsx'));
const Onboarding = lazy(() => import('./Onboarding.jsx'));
const SessionRecovery = lazy(() => import('./SessionRecovery.jsx'));
function SessionRoutes() {
  const location = useLocation();
  const { status, merchant } = useSession();
  const demo = location.pathname.startsWith('/demo/') || location.pathname === '/dev/ui';
  if (demo) return <MerchantApp />;
  if (status === 'loading') return <Skeleton lines={4} />;
  if (status === 'unavailable' && location.pathname !== '/login') return <SessionRecovery />;
  if (location.pathname === '/login')
    return merchant ? (
      <Navigate replace to={merchant.onboardingStep < 4 ? '/onboarding' : '/bill'} />
    ) : (
      <Login />
    );
  if (!merchant) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (merchant.onboardingStep < 4 || location.pathname === '/onboarding') return <Onboarding />;
  return <MerchantApp />;
}
export default function MerchantEntry() {
  return (
    <SessionProvider>
      <Suspense fallback={<Skeleton lines={4} />}>
        <SessionRoutes />
      </Suspense>
    </SessionProvider>
  );
}
