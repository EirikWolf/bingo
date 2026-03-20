import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listenToLocation, listenToFinishedGames } from '@/services/firestore';
import { WIN_CONDITION_LABELS } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import type { Location, Game } from '@/types';

export default function GameHistoryPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const [location, setLocation] = useState<Location | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const unsub = listenToLocation(locationId, setLocation);
    return unsub;
  }, [locationId]);

  useEffect(() => {
    if (!locationId) return;
    const unsub = listenToFinishedGames(locationId, (data) => {
      setGames(data);
      setLoading(false);
    });
    return unsub;
  }, [locationId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-bingo-600 text-sm">
            ← Tilbake
          </button>
          <h1 className="font-semibold text-gray-900 truncate mx-2">
            Historikk: {location?.name ?? 'Lokasjon'}
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {games.length === 0 ? (
          <Card className="text-center">
            <p className="text-gray-500">Ingen avsluttede spill ennå.</p>
          </Card>
        ) : (
          games.map((game) => (
            <Card key={game.id}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-500">
                    {game.finishedAt?.toDate().toLocaleDateString('nb-NO', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }) ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {game.finishedAt?.toDate().toLocaleTimeString('nb-NO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <Badge variant="default">Avsluttet</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-sm mb-3">
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-xs text-gray-400">Kuponger</p>
                  <p className="text-lg font-bold text-gray-900">{game.couponCount}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-xs text-gray-400">Tall trukket</p>
                  <p className="text-lg font-bold text-gray-900">{game.drawnNumbers.length}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-xs text-gray-400">Vinnere</p>
                  <p className="text-lg font-bold text-gray-900">{game.winners.length}</p>
                </div>
              </div>

              {/* Commitment */}
              <p className="text-xs text-gray-500 mb-2">
                Forpliktelse: <span className="text-gray-700">{game.commitment}</span>
              </p>

              {/* Winners */}
              {game.winners.length > 0 && (
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">Vinnere:</p>
                  {game.winners.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-1.5 text-sm mb-1"
                    >
                      <span className="font-medium text-green-800">{w.displayName}</span>
                      <Badge variant="success">
                        {WIN_CONDITION_LABELS[w.winCondition]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Drawn numbers summary */}
              {game.drawnNumbers.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-bingo-600 cursor-pointer hover:underline">
                    Vis alle trukne tall ({game.drawnNumbers.length})
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {game.drawnNumbers.map((num) => (
                      <span
                        key={num}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700"
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </Card>
          ))
        )}

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => navigate(`/spill/${locationId}`)}
        >
          Tilbake til spillet
        </Button>
      </main>
    </div>
  );
}
