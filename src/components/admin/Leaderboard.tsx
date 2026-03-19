import { useEffect, useState } from 'react';
import { listenToLeaderboard } from '@/services/firestore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { LeaderboardEntry } from '@/types';

interface LeaderboardProps {
  locationId: string;
}

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

export function Leaderboard({ locationId }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenToLeaderboard(locationId, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return unsub;
  }, [locationId]);

  if (loading) {
    return <Card className="text-center"><p className="text-gray-400">Laster toppliste...</p></Card>;
  }

  if (entries.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-sm text-gray-400">
          Topplisten oppdateres etter første vinner.
        </p>
      </Card>
    );
  }

  // Only show players with at least 1 win or game
  const activeEntries = entries.filter((e) => e.wins > 0 || e.gamesPlayed > 0);

  return (
    <Card padding="none">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-900">Toppliste</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {activeEntries.map((entry, index) => {
          const medal = index < 3 ? MEDAL_EMOJIS[index] : null;
          const winRate = entry.gamesPlayed > 0
            ? Math.round((entry.wins / entry.gamesPlayed) * 100)
            : 0;

          return (
            <div key={entry.userId} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Rank */}
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-100 text-gray-600' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-50 text-gray-400'
                }`}>
                  {medal ?? `${index + 1}`}
                </div>

                {/* Name + initial avatar */}
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bingo-100 text-bingo-600 font-bold text-sm">
                    {entry.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{entry.displayName}</p>
                    <p className="text-xs text-gray-400">
                      {entry.gamesPlayed} spill{winRate > 0 ? ` · ${winRate}% vinnrate` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Win count */}
              <Badge variant={entry.wins > 0 ? 'success' : 'default'}>
                {entry.wins} {entry.wins === 1 ? 'seier' : 'seiere'}
              </Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
