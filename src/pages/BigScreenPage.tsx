import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { listenToLocation, listenToGame } from '@/services/firestore';
import { BigNumber } from '@/components/bigscreen/BigNumber';
import { NumberBoard } from '@/components/bigscreen/NumberBoard';
import { WinnerAnnouncement } from '@/components/bigscreen/WinnerAnnouncement';
import { Spinner } from '@/components/ui/Spinner';
import { GAME_STATUS_LABELS } from '@/utils/constants';
import { bingoSpeech } from '@/utils/speech';
import { celebrateBigScreen } from '@/utils/effects';
import type { Location, Game } from '@/types';

export default function BigScreenPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const [location, setLocation] = useState<Location | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevCurrentNumberRef = useRef<number | null>(null);

  // Listen to location
  useEffect(() => {
    if (!locationId) return;
    const unsub = listenToLocation(locationId, (loc) => {
      setLocation(loc);
      setLoading(false);
    });
    return unsub;
  }, [locationId]);

  // Listen to active game
  useEffect(() => {
    if (!locationId || !location?.activeGameId) {
      setGame(null);
      return;
    }
    const unsub = listenToGame(locationId, location.activeGameId, setGame);
    return unsub;
  }, [locationId, location?.activeGameId]);

  // Announce numbers on big screen too (if speech available)
  useEffect(() => {
    if (location?.settings.speech?.enabled) {
      bingoSpeech.setConfig({
        enabled: true,
        voiceURI: location.settings.speech.voiceURI,
        rate: location.settings.speech.rate,
        volume: location.settings.speech.volume,
      });
    }
  }, [location?.settings.speech]);

  useEffect(() => {
    if (game?.currentNumber && game.currentNumber !== prevCurrentNumberRef.current) {
      bingoSpeech.announceNumber(game.currentNumber);
      prevCurrentNumberRef.current = game.currentNumber;
    }
  }, [game?.currentNumber]);

  // Countdown timer synced from game.lastDrawAt + game.autoDrawIntervalMs
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (!game?.autoDrawActive || !game.lastDrawAt || game.status !== 'active') {
      setCountdown(0);
      return;
    }

    const intervalMs = game.autoDrawIntervalMs || 5000;

    function tick() {
      if (!game?.lastDrawAt) return;
      const lastDrawTime = game.lastDrawAt.toDate().getTime();
      const now = Date.now();
      const elapsed = now - lastDrawTime;
      const remaining = Math.max(0, Math.ceil((intervalMs - elapsed) / 1000));
      setCountdown(remaining);
    }

    tick();
    countdownRef.current = setInterval(tick, 500);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [game?.autoDrawActive, game?.lastDrawAt, game?.autoDrawIntervalMs, game?.status]);

  const drawnSet = useMemo(
    () => new Set(game?.drawnNumbers ?? []),
    [game?.drawnNumbers]
  );

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    function handleFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Confetti on winner announcement
  const prevWinnersCountRef = useRef(0);
  useEffect(() => {
    const count = game?.winners.length ?? 0;
    if (count > prevWinnersCountRef.current && prevWinnersCountRef.current >= 0) {
      if (count > 0) {
        celebrateBigScreen();
      }
    }
    prevWinnersCountRef.current = count;
  }, [game?.winners.length]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => bingoSpeech.cancel();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bingo-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bingo-900">
        <p className="text-xl text-white">Lokasjon ikke funnet</p>
      </div>
    );
  }

  const statusLabel = game ? GAME_STATUS_LABELS[game.status] ?? game.status : 'Ingen spill';

  return (
    <div className="min-h-screen bg-bingo-900 text-white p-4 sm:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">{location.name}</h1>
          <p className="text-bingo-300 text-sm mt-1">{statusLabel}</p>
        </div>
        <div className="flex items-center gap-4">
          {game && (
            <div className="text-right text-sm text-bingo-300">
              <p>{game.couponCount} kuponger</p>
              <p>{game.drawnNumbers.length} av {game.totalNumbers} tall</p>
            </div>
          )}
          <button
            onClick={toggleFullscreen}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 transition-colors"
            title={isFullscreen ? 'Avslutt fullskjerm' : 'Fullskjerm'}
          >
            {isFullscreen ? '⊠' : '⊞'}
          </button>
        </div>
      </header>

      {/* No game state */}
      {!game && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-2xl text-bingo-300">Venter på at spillet starter...</p>
        </div>
      )}

      {/* Game open state */}
      {game && game.status === 'open' && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-3xl font-bold text-bingo-200">Åpent for kupongkjøp!</p>
          <p className="mt-4 text-xl text-bingo-400">{game.couponCount} kuponger kjøpt</p>
          <p className="mt-2 text-bingo-400">Forpliktelse: {game.commitment}</p>

          {/* QR code to join */}
          <div className="mt-8 flex flex-col items-center">
            <div className="rounded-2xl bg-white p-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://bingoportalen.web.app/spill/${locationId}`)}`}
                alt="QR-kode for å bli med"
                width={200}
                height={200}
              />
            </div>
            <p className="mt-3 text-sm text-bingo-300">Skann for å bli med</p>
            <p className="text-xs text-bingo-400 mt-1">bingoportalen.web.app</p>
          </div>
        </div>
      )}

      {/* Active game */}
      {game && (game.status === 'active' || game.status === 'paused') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Current number + countdown + recent */}
          <div className="lg:col-span-1 flex flex-col items-center gap-6">
            <div>
              <p className="text-center text-sm text-bingo-400 mb-2 uppercase tracking-wider">
                Siste tall
              </p>
              <BigNumber number={game.currentNumber} />
            </div>

            {/* Countdown to next draw */}
            {game.autoDrawActive && countdown > 0 && game.status === 'active' && (
              <div className="flex flex-col items-center">
                <p className="text-xs text-bingo-400 mb-1">Neste tall om</p>
                <div className="relative h-16 w-16">
                  <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18" cy="18" r="15.9"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="2"
                    />
                    <circle
                      cx="18" cy="18" r="15.9"
                      fill="none"
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth="2"
                      strokeDasharray={`${(countdown / ((game.autoDrawIntervalMs || 5000) / 1000)) * 100} 100`}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                    {countdown}
                  </span>
                </div>
              </div>
            )}

            {/* Recent draws */}
            {game.drawnNumbers.length > 1 && (
              <div>
                <p className="text-center text-xs text-bingo-400 mb-2">Forrige tall</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {game.drawnNumbers
                    .slice(-6, -1)
                    .reverse()
                    .map((num) => (
                      <div
                        key={num}
                        className={`number-ball h-10 w-10 text-sm ${getBallColorClass(num)}`}
                      >
                        {num}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Pause indicator */}
            {game.status === 'paused' && (
              <div className="rounded-lg bg-yellow-500/20 border border-yellow-500/40 px-6 py-3 text-center">
                <p className="text-lg font-semibold text-yellow-300">PAUSE</p>
              </div>
            )}
          </div>

          {/* Right: Number board */}
          <div className="lg:col-span-2">
            <NumberBoard drawnNumbers={drawnSet} />
          </div>
        </div>
      )}

      {/* Winners */}
      {game && game.winners.length > 0 && (
        <div className="mt-8">
          <WinnerAnnouncement winners={game.winners} />
        </div>
      )}

      {/* Finished state */}
      {game && game.status === 'finished' && game.winners.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-2xl text-bingo-300">Spillet er avsluttet</p>
          <p className="mt-2 text-bingo-400">{game.drawnNumbers.length} tall ble trukket</p>
        </div>
      )}
    </div>
  );
}

function getBallColorClass(num: number): string {
  const col = Math.floor((num - 1) / 15);
  const colors = ['bg-ball-b', 'bg-ball-i', 'bg-ball-n', 'bg-ball-g', 'bg-ball-o'];
  return colors[col] ?? 'bg-gray-400';
}
