import { useEffect, useState } from 'react';
import { listenToLocationStats } from '@/services/firestore';
import { Card } from '@/components/ui/Card';
import type { LocationStats } from '@/types';

interface LocationStatsCardProps {
  locationId: string;
}

export function LocationStatsCard({ locationId }: LocationStatsCardProps) {
  const [stats, setStats] = useState<LocationStats | null>(null);

  useEffect(() => {
    const unsub = listenToLocationStats(locationId, setStats);
    return unsub;
  }, [locationId]);

  if (!stats) {
    return (
      <Card className="text-center">
        <p className="text-sm text-gray-400">
          Statistikk oppdateres etter første avsluttede spill.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <Card padding="sm">
          <p className="text-gray-400">Spill</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalGames}</p>
        </Card>
        <Card padding="sm">
          <p className="text-gray-400">Kuponger</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalCoupons}</p>
        </Card>
        <Card padding="sm">
          <p className="text-gray-400">Vinnere</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalWinners}</p>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center text-sm">
        <Card padding="sm">
          <p className="text-gray-400">Snitt spillere/spill</p>
          <p className="text-xl font-bold text-bingo-600">{stats.averagePlayersPerGame}</p>
        </Card>
        <Card padding="sm">
          <p className="text-gray-400">Snitt kuponger/spill</p>
          <p className="text-xl font-bold text-bingo-600">{stats.averageCouponsPerGame}</p>
        </Card>
      </div>
      {stats.lastGameAt && (
        <p className="text-xs text-gray-400 text-center">
          Siste spill: {stats.lastGameAt.toDate().toLocaleDateString('nb-NO')}
        </p>
      )}
    </div>
  );
}
