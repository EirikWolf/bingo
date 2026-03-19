import { useEffect, Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';
import { InstallPrompt } from '@/components/ui/InstallPrompt';

// Lazy-loaded pages for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const BigScreenPage = lazy(() => import('./pages/BigScreenPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DevAdminPage = lazy(() => import('./pages/DevAdminPage'));
const GameHistoryPage = lazy(() => import('./pages/GameHistoryPage'));

function PageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export default function App() {
  const { firebaseUser, loading, initialize } = useAuthStore();

  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);

  if (loading) {
    return <PageSpinner />;
  }

  // BigScreen is always accessible (no login required)
  // Everything else requires authentication
  return (
    <>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/skjerm/:locationId" element={<BigScreenPage />} />
          {firebaseUser ? (
            <>
              <Route path="/" element={<HomePage />} />
              <Route path="/spill/:locationId" element={<GamePage />} />
              <Route path="/admin/:locationId" element={<AdminPage />} />
              <Route path="/admin" element={<SuperAdminPage />} />
              <Route path="/profil" element={<ProfilePage />} />
              <Route path="/historikk/:locationId" element={<GameHistoryPage />} />
              {import.meta.env.DEV && (
                <Route path="/dev-admin" element={<DevAdminPage />} />
              )}
              <Route path="*" element={<HomePage />} />
            </>
          ) : (
            <Route path="*" element={<LoginPage />} />

          )}
        </Routes>
      </Suspense>
      <InstallPrompt />
    </>
  );
}
