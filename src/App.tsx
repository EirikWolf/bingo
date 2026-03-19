import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import BigScreenPage from './pages/BigScreenPage';
import AdminPage from './pages/AdminPage';
import SuperAdminPage from './pages/SuperAdminPage';
import ProfilePage from './pages/ProfilePage';
import DevAdminPage from './pages/DevAdminPage';
import { InstallPrompt } from '@/components/ui/InstallPrompt';

export default function App() {
  const { firebaseUser, loading, initialize } = useAuthStore();

  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // BigScreen is always accessible (no login required)
  // Everything else requires authentication
  return (
    <>
      <Routes>
        <Route path="/skjerm/:locationId" element={<BigScreenPage />} />
        {firebaseUser ? (
          <>
            <Route path="/" element={<HomePage />} />
            <Route path="/spill/:locationId" element={<GamePage />} />
            <Route path="/admin/:locationId" element={<AdminPage />} />
            <Route path="/admin" element={<SuperAdminPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            {import.meta.env.DEV && (
              <Route path="/dev-admin" element={<DevAdminPage />} />
            )}
            <Route path="*" element={<HomePage />} />
          </>
        ) : (
          <Route path="*" element={<LoginPage />} />

        )}
      </Routes>
      <InstallPrompt />
    </>
  );
}
