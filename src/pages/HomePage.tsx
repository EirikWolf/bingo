import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocationStore } from '@/stores/locationStore';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { OnboardingWizard } from '@/components/admin/OnboardingWizard';
import { signOut } from '@/services/auth';
import type { Location } from '@/types';

export default function HomePage() {
  const navigate = useNavigate();
  const { locations, loading, initialize } = useLocationStore();
  const user = useAuthStore((s) => s.user);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);

  function handleSelectLocation(locationId: string) {
    navigate(`/spill/${locationId}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-bingo-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4">
        <h1 className="text-xl font-bold text-bingo-800 dark:text-bingo-300">BingoPortalen</h1>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <button
                onClick={() => navigate('/profil')}
                className="text-sm text-gray-600 hover:text-bingo-600 focus:outline-none focus:underline"
                aria-label="Ga til profil"
              >
                {user.displayName ?? 'Min profil'}
              </button>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Logg ut
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-lg px-4 pb-8">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Velg lokasjon</h2>
          <p className="mt-1 text-sm text-gray-500">Velg hvor du vil spille bingo</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : showOnboarding && user ? (
          <OnboardingWizard
            userId={user.uid}
            onComplete={() => setShowOnboarding(false)}
          />
        ) : locations.length === 0 ? (
          <Card className="text-center">
            <p className="text-gray-500 dark:text-gray-400">Ingen lokasjoner tilgjengelig ennå.</p>
            {user && (
              <Button
                className="mt-3"
                onClick={() => setShowOnboarding(true)}
              >
                Opprett ny lokasjon
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <LocationCard
                key={loc.id}
                location={loc}
                isAdmin={user?.uid ? loc.adminUids.includes(user.uid) : false}
                onSelect={() => handleSelectLocation(loc.id)}
                onAdmin={() => navigate(`/admin/${loc.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

interface LocationCardProps {
  location: Location;
  isAdmin: boolean;
  onSelect: () => void;
  onAdmin: () => void;
}

function LocationCard({ location, isAdmin, onSelect, onAdmin }: LocationCardProps) {
  const hasActiveGame = location.activeGameId !== null;

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-bingo-500 focus:ring-offset-2"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`Velg ${location.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{location.name}</h3>
          {location.description && (
            <p className="mt-0.5 text-sm text-gray-500">{location.description}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {location.playerCount} {location.playerCount === 1 ? 'spiller' : 'spillere'}
            </span>
            {isAdmin && (
              <button
                className="text-xs text-bingo-600 font-medium hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdmin();
                }}
              >
                Admin →
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {hasActiveGame ? (
            <Badge variant="success">Aktivt spill</Badge>
          ) : (
            <Badge variant="default">Ingen spill</Badge>
          )}
          {location.settings?.vippsNumber && (
            <Badge variant="info">Vipps</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
