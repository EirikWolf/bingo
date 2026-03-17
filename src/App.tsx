import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

// Placeholder-sider — erstattes med ekte komponenter
function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-bingo-800">{title}</h1>
        <p className="mt-2 text-gray-500">Under utvikling</p>
      </div>
    </div>
  );
}

export default function App() {
  const init = useAuthStore((s) => s.init);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    const unsub = init();
    return unsub;
  }, [init]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-bingo-200 border-t-bingo-600" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Placeholder title="Velg lokasjon" />} />
      <Route path="/spill/:locationId" element={<Placeholder title="Spillervisning" />} />
      <Route path="/skjerm/:locationId" element={<Placeholder title="Storskjerm" />} />
      <Route path="/admin/:locationId" element={<Placeholder title="Kontrollpanel" />} />
      <Route path="/admin" element={<Placeholder title="Superadmin" />} />
      <Route path="/profil" element={<Placeholder title="Min profil" />} />
    </Routes>
  );
}
