import { useEffect, useMemo, useState } from 'react';
import { listenToLocationCommitments } from '@/services/firestore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Commitment } from '@/types';

interface PlayerOverviewProps {
  locationId: string;
}

interface PlayerSummary {
  userId: string;
  displayName: string;
  phone: string | null;
  totalCommitments: number;
  pendingCount: number;
  confirmedCount: number;
  cancelledCount: number;
}

export function PlayerOverview({ locationId }: PlayerOverviewProps) {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'total' | 'pending'>('total');

  useEffect(() => {
    const unsub = listenToLocationCommitments(locationId, (data) => {
      setCommitments(data);
      setLoading(false);
    });
    return unsub;
  }, [locationId]);

  const players = useMemo(() => {
    const map = new Map<string, PlayerSummary>();

    for (const c of commitments) {
      const existing = map.get(c.userId);
      if (existing) {
        existing.totalCommitments++;
        if (c.status === 'pending') existing.pendingCount++;
        else if (c.status === 'confirmed') existing.confirmedCount++;
        else if (c.status === 'cancelled') existing.cancelledCount++;
        // Update phone if available
        if (c.userPhone && !existing.phone) existing.phone = c.userPhone;
      } else {
        map.set(c.userId, {
          userId: c.userId,
          displayName: c.userDisplayName,
          phone: c.userPhone,
          totalCommitments: 1,
          pendingCount: c.status === 'pending' ? 1 : 0,
          confirmedCount: c.status === 'confirmed' ? 1 : 0,
          cancelledCount: c.status === 'cancelled' ? 1 : 0,
        });
      }
    }

    const arr = Array.from(map.values());

    // Sort
    if (sortBy === 'total') {
      arr.sort((a, b) => b.totalCommitments - a.totalCommitments);
    } else if (sortBy === 'pending') {
      arr.sort((a, b) => b.pendingCount - a.pendingCount);
    } else {
      arr.sort((a, b) => a.displayName.localeCompare(b.displayName, 'nb'));
    }

    return arr;
  }, [commitments, sortBy]);

  if (loading) {
    return <Card className="text-center"><p className="text-gray-400">Laster spilleroversikt...</p></Card>;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 text-center text-sm">
        <Card padding="sm">
          <p className="text-gray-400">Spillere</p>
          <p className="text-xl font-bold text-gray-900">{players.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-gray-400">Forpliktelser</p>
          <p className="text-xl font-bold text-gray-900">{commitments.length}</p>
        </Card>
      </div>

      {/* Sort controls */}
      <div className="flex gap-2 text-sm">
        <span className="text-gray-500 self-center">Sorter:</span>
        {([['total', 'Flest forpliktelser'], ['pending', 'Flest ventende'], ['name', 'Navn']] as [typeof sortBy, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              sortBy === key
                ? 'bg-bingo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Player list */}
      {players.length === 0 ? (
        <Card className="text-center">
          <p className="text-gray-500">Ingen spillere med forpliktelser ennå.</p>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-gray-50">
            {players.map((p) => (
              <div key={p.userId} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bingo-100 text-bingo-600 font-bold">
                    {p.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{p.displayName}</p>
                    {p.phone && (
                      <p className="text-xs text-gray-400">{p.phone}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="default">{p.totalCommitments} totalt</Badge>
                  {p.pendingCount > 0 && (
                    <Badge variant="warning">{p.pendingCount} ventende</Badge>
                  )}
                  {p.confirmedCount > 0 && (
                    <Badge variant="success">{p.confirmedCount} bekreftet</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
