import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { listenToLocation, listenToGame } from '@/services/firestore';
import { drawNumber, updateAutoDrawState } from '@/services/actions';
import { BigNumber } from '@/components/bigscreen/BigNumber';
import { NumberBoard } from '@/components/bigscreen/NumberBoard';
import { WinnerAnnouncement } from '@/components/bigscreen/WinnerAnnouncement';
import { Spinner } from '@/components/ui/Spinner';
import { GAME_STATUS_LABELS, TOTAL_NUMBERS } from '@/utils/constants';
import { bingoSpeech } from '@/utils/speech';
import { celebrateBigScreen } from '@/utils/effects';
import type { Location, Game } from '@/types';

export default function BigScreenPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const user = useAuthStore((s) => s.user);
  const [location, setLocation] = useState<Location | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [autoDrawEnabled, setAutoDrawEnabled] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoDrawRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevCurrentNumberRef = useRef<number | null>(null);

  const isAdmin = user?.uid ? (location?.adminUids.includes(user.uid) ?? false) : false;

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

  // Sync autoDrawEnabled from Firestore game state
  useEffect(() => {
    if (game?.autoDrawActive && game.status === 'active') {
      setAutoDrawEnabled(true);
    } else {
      setAutoDrawEnabled(false);
    }
  }, [game?.autoDrawActive, game?.status]);

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

  // Available numbers for draw
  const availableNumbers = useMemo(() => {
    const drawn = new Set(game?.drawnNumbers ?? []);
    return Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1).filter((n) => !drawn.has(n));
  }, [game?.drawnNumbers]);

  const autoDrawInterval = (game?.autoDrawIntervalMs ?? 5000) / 1000;

  const handleDraw = useCallback(async () => {
    if (!locationId || !game || availableNumbers.length === 0 || drawing) return;
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const number = availableNumbers[randomIndex]!;
    setDrawing(true);
    try {
      await drawNumber(locationId, game.id, number);
    } catch (error) {
      console.error('Draw error:', error);
      toast.error('Kunne ikke trekke tall');
    } finally {
      setDrawing(false);
    }
  }, [locationId, game, availableNumbers, drawing]);

  async function handleStartAutoDraw() {
    if (!locationId || !game) return;
    setAutoDrawEnabled(true);
    await updateAutoDrawState(locationId, game.id, true, autoDrawInterval * 1000);
    handleDraw();
  }

  async function handlePauseAutoDraw() {
    if (!locationId || !game) return;
    setAutoDrawEnabled(false);
    setCountdown(0);
    await updateAutoDrawState(locationId, game.id, false, autoDrawInterval * 1000);
  }

  // Auto-draw loop — actually draws numbers on interval
  useEffect(() => {
    if (autoDrawRef.current) {
      clearInterval(autoDrawRef.current);
      autoDrawRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (autoDrawEnabled && game?.status === 'active' && availableNumbers.length > 0 && isAdmin) {
      const intervalMs = autoDrawInterval * 1000;
      let nextDrawTime = Date.now() + intervalMs;

      const tick = () => {
        const remaining = Math.max(0, Math.ceil((nextDrawTime - Date.now()) / 1000));
        setCountdown(remaining);
      };
      tick();
      countdownRef.current = setInterval(tick, 500);

      autoDrawRef.current = setInterval(() => {
        handleDraw();
        nextDrawTime = Date.now() + intervalMs;
      }, intervalMs);
    } else if (!isAdmin && autoDrawEnabled) {
      // Non-admin: just show countdown from Firestore timestamps
      const intervalMs = game?.autoDrawIntervalMs || 5000;
      const tick = () => {
        if (!game?.lastDrawAt) return;
        const lastDrawTime = game.lastDrawAt.toDate().getTime();
        const elapsed = Date.now() - lastDrawTime;
        const remaining = Math.max(0, Math.ceil((intervalMs - elapsed) / 1000));
        setCountdown(remaining);
      };
      tick();
      countdownRef.current = setInterval(tick, 500);
    } else {
      setCountdown(0);
    }

    return () => {
      if (autoDrawRef.current) {
        clearInterval(autoDrawRef.current);
        autoDrawRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [autoDrawEnabled, game?.status, availableNumbers.length, autoDrawInterval, handleDraw, isAdmin, game?.lastDrawAt, game?.autoDrawIntervalMs]);

  // Stop auto-draw when game is not active
  useEffect(() => {
    if (game?.status !== 'active') {
      setAutoDrawEnabled(false);
    }
  }, [game?.status]);

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
            {autoDrawEnabled && countdown > 0 && game.status === 'active' && (
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

      {/* Admin draw controls — fixed bottom-left */}
      {isAdmin && game && game.status === 'active' && (
        <div className="fixed bottom-6 left-6 z-50">
          {showControls ? (
            <div className="flex items-center gap-2 rounded-2xl bg-black/70 backdrop-blur-sm px-4 py-3 shadow-lg border border-white/10">
              {autoDrawEnabled ? (
                <button
                  onClick={handlePauseAutoDraw}
                  className="flex items-center gap-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-5 py-2.5 text-sm transition-colors"
                >
                  <span className="text-lg">⏸</span> Pause
                </button>
              ) : (
                <button
                  onClick={handleStartAutoDraw}
                  disabled={availableNumbers.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white font-semibold px-5 py-2.5 text-sm transition-colors"
                >
                  <span className="text-lg">▶</span> Start
                </button>
              )}
              <button
                onClick={() => {
                  handleDraw();
                  if (autoDrawEnabled) {
                    // Reset countdown visual after manual draw
                  }
                }}
                disabled={drawing || availableNumbers.length === 0}
                className="flex items-center gap-2 rounded-xl bg-bingo-600 hover:bg-bingo-500 disabled:opacity-40 text-white font-semibold px-5 py-2.5 text-sm transition-colors"
              >
                <span className="text-lg">⏭</span> Neste
              </button>
              <button
                onClick={() => setShowControls(false)}
                className="ml-1 rounded-lg p-1.5 text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                title="Skjul kontroller"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowControls(true)}
              className="rounded-full bg-black/50 backdrop-blur-sm p-3 text-white/60 hover:text-white hover:bg-black/70 transition-colors border border-white/10 shadow-lg"
              title="Vis kontroller"
            >
              🎮
            </button>
          )}
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
