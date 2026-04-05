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
import { TOTAL_NUMBERS } from '@/utils/constants';
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
  const [autoDrawEnabled, setAutoDrawEnabled] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevCurrentNumberRef = useRef<number | null>(null);

  // Refs for local auto-draw (always-fresh data)
  const gameRef = useRef<Game | null>(null);
  const locationIdRef = useRef(locationId);
  const localDrawingRef = useRef(false);
  const localAutoDrawRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingNumbersRef = useRef<Set<number>>(new Set());

  // Keep refs in sync
  gameRef.current = game;
  locationIdRef.current = locationId;

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

  // Manual draw handler (for "Neste" button)
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

  // Start/pause auto-draw — toggles Firestore flag
  async function handleStartAutoDraw() {
    if (!locationId || !game) return;
    await updateAutoDrawState(locationId, game.id, true, autoDrawInterval * 1000);
  }

  async function handlePauseAutoDraw() {
    if (!locationId || !game) return;
    setCountdown(0);
    await updateAutoDrawState(locationId, game.id, false, autoDrawInterval * 1000);
  }

  // --- Local auto-draw loop ---
  // Runs directly on BigScreenPage using URL locationId, not dependent on global useAutoDraw.
  // Uses refs so the interval callback always reads fresh game/location state.
  useEffect(() => {
    if (localAutoDrawRef.current) {
      clearInterval(localAutoDrawRef.current);
      localAutoDrawRef.current = null;
    }

    const shouldDraw = isAdmin && autoDrawEnabled && game?.status === 'active';
    if (!shouldDraw) return;

    const intervalMs = game?.autoDrawIntervalMs || 5000;

    const performDraw = async () => {
      const g = gameRef.current;
      const lid = locationIdRef.current;
      if (localDrawingRef.current || !lid || !g) return;
      if (g.status !== 'active' || !g.autoDrawActive) return;

      // Combine server-confirmed numbers with locally pending ones
      const drawn = new Set(g.drawnNumbers ?? []);
      for (const n of pendingNumbersRef.current) {
        drawn.add(n);
      }
      if (drawn.size >= TOTAL_NUMBERS) return;

      const available = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1)
        .filter((n) => !drawn.has(n));
      if (available.length === 0) return;

      const number = available[Math.floor(Math.random() * available.length)]!;

      pendingNumbersRef.current.add(number);
      localDrawingRef.current = true;
      try {
        await drawNumber(lid, g.id, number);
      } catch (error) {
        pendingNumbersRef.current.delete(number);
        console.error('[BigScreen autoDraw] error:', error);
      } finally {
        localDrawingRef.current = false;
      }
    };

    // Draw immediately, then repeat at interval
    performDraw();
    localAutoDrawRef.current = setInterval(performDraw, intervalMs);

    return () => {
      if (localAutoDrawRef.current) {
        clearInterval(localAutoDrawRef.current);
        localAutoDrawRef.current = null;
      }
    };
  }, [isAdmin, autoDrawEnabled, game?.status, game?.autoDrawIntervalMs]);

  // Clear pending numbers when drawnNumbers updates from Firestore
  useEffect(() => {
    if (game?.drawnNumbers) {
      const serverDrawn = new Set(game.drawnNumbers);
      for (const n of pendingNumbersRef.current) {
        if (serverDrawn.has(n)) {
          pendingNumbersRef.current.delete(n);
        }
      }
    }
  }, [game?.drawnNumbers]);

  // Countdown display — calculates from Firestore timestamps
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (autoDrawEnabled && game?.status === 'active') {
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
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [autoDrawEnabled, game?.status, game?.lastDrawAt, game?.autoDrawIntervalMs]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => bingoSpeech.cancel();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bigscreen-bg">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex h-screen items-center justify-center bigscreen-bg">
        <p className="text-xl text-white">Lokasjon ikke funnet</p>
      </div>
    );
  }

  const countdownFraction = countdown / ((game?.autoDrawIntervalMs || 5000) / 1000);

  return (
    <div className="h-screen overflow-hidden bigscreen-bg text-white flex flex-col">

      {/* ─── Top Bar ─── */}
      <header className="shrink-0 px-6 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <span className="text-bigscreen-accent text-lg">✦</span>
          <h1 className="text-xl font-bold tracking-wide">{location.name}</h1>
        </div>
        <div className="flex items-center gap-5">
          {game && (
            <>
              <span className="text-sm text-bigscreen-silver">
                Kuponger: <strong className="text-white">{game.couponCount}</strong>
              </span>
              <span className="text-sm text-bigscreen-silver">
                Siste tall: <strong className="text-white">{game.drawnNumbers.length}/{game.totalNumbers}</strong>
              </span>
            </>
          )}
          <button
            onClick={toggleFullscreen}
            className="text-bigscreen-silver/50 hover:text-white transition-colors text-lg"
            title={isFullscreen ? 'Avslutt fullskjerm' : 'Fullskjerm'}
          >
            {isFullscreen ? '⊠' : '⊞'}
          </button>
        </div>
      </header>

      {/* ─── No game ─── */}
      {!game && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-2xl text-bigscreen-silver">Venter på at spillet starter...</p>
        </div>
      )}

      {/* ─── Open for purchase ─── */}
      {game && game.status === 'open' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <p className="text-3xl font-bold">Åpent for kupongkjøp!</p>
          <p className="text-xl text-bigscreen-silver">{game.couponCount} kuponger kjøpt</p>
          <div className="glass-panel rounded-2xl p-6 flex flex-col items-center" style={{ border: '1px solid rgba(201,168,76,0.2)' }}>
            <div className="rounded-xl bg-white p-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://bingoportalen.web.app/spill/${locationId}`)}`}
                alt="QR-kode"
                width={180}
                height={180}
              />
            </div>
            <p className="mt-3 text-sm text-bigscreen-silver">Skann for å bli med</p>
          </div>
        </div>
      )}

      {/* ═══ ACTIVE GAME: 3-column layout ═══ */}
      {game && (game.status === 'active' || game.status === 'paused') && (
        <div className="flex-1 min-h-0 flex">

          {/* ── Left Column: Previous numbers as hexagons ── */}
          <div className="shrink-0 flex flex-col items-center justify-center gap-1 px-4 py-2" style={{ width: 'clamp(10rem, 18vw, 14rem)' }}>
            {game.drawnNumbers.length > 1 && game.drawnNumbers
              .slice(-6, -1)
              .reverse()
              .map((num, i) => {
                const hex = getHexForNumber(num);
                return (
                  <div
                    key={num}
                    className="hex-tile"
                    style={{
                      background: `linear-gradient(135deg, ${hex}cc, ${hex}88)`,
                      opacity: 1 - i * 0.12,
                      boxShadow: `0 0 15px 3px ${hex}40`,
                    }}
                  >
                    {/* Hex glow border */}
                    <div
                      className="hex-border"
                      style={{ background: `linear-gradient(135deg, ${hex}, ${hex}66)` }}
                    />
                    {num}
                  </div>
                );
              })}
          </div>

          {/* ── Center Column: 3D Sphere Machine ── */}
          <div className="flex-1 flex flex-col items-center justify-center relative min-w-0">
            {/* Radial ambient glow behind sphere */}
            {game.currentNumber && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at 50% 50%, ${getHexForNumber(game.currentNumber)}18 0%, transparent 55%)`,
                }}
              />
            )}

            {/* Sphere */}
            <div className="relative z-10">
              <BigNumber number={game.currentNumber} />
            </div>

            {/* B-I-N-G-O column dots below sphere */}
            <div className="relative z-10 flex gap-2 mt-3">
              {(['bg-ball-b', 'bg-ball-i', 'bg-ball-n', 'bg-ball-g', 'bg-ball-o'] as const).map((c, i) => (
                <div key={i} className={`w-4 h-4 rounded-full ${c} opacity-80`} />
              ))}
            </div>

            {/* Countdown bar */}
            {autoDrawEnabled && countdown > 0 && game.status === 'active' && (
              <div className="relative z-10 flex flex-col items-center gap-1 mt-3">
                <div className="w-48 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-bigscreen-accent transition-all duration-500"
                    style={{ width: `${countdownFraction * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-bigscreen-silver/50 font-mono">{countdown}s</span>
              </div>
            )}

            {/* Pause indicator */}
            {game.status === 'paused' && (
              <div className="relative z-10 mt-3 border border-bigscreen-accent/40 bg-bigscreen-accent/10 px-6 py-1.5 rounded-full">
                <p className="text-sm font-semibold text-bigscreen-accent tracking-widest">PAUSE</p>
              </div>
            )}
          </div>

          {/* ── Right Column: Compact Number Board ── */}
          <div className="shrink-0 py-2 pr-3" style={{ width: 'clamp(14rem, 28vw, 22rem)' }}>
            <NumberBoard drawnNumbers={drawnSet} currentNumber={game.currentNumber} />
          </div>
        </div>
      )}

      {/* ─── Winners overlay ─── */}
      {game && game.winners.length > 0 && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <WinnerAnnouncement winners={game.winners} />
        </div>
      )}

      {/* ─── Finished ─── */}
      {game && game.status === 'finished' && game.winners.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-2xl text-bigscreen-silver">Spillet er avsluttet</p>
          <p className="mt-2 text-bigscreen-silver/60">{game.drawnNumbers.length} tall ble trukket</p>
        </div>
      )}

      {/* ─── Admin Controls: bottom-right ─── */}
      {isAdmin && game && game.status === 'active' && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
          {autoDrawEnabled ? (
            <button
              onClick={handlePauseAutoDraw}
              className="glass-panel rounded-xl bg-bigscreen-accent/20 hover:bg-bigscreen-accent/40 text-bigscreen-accent font-semibold px-5 py-2.5 text-sm transition-colors"
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={handleStartAutoDraw}
              disabled={availableNumbers.length === 0}
              className="glass-panel rounded-xl bg-green-600/80 hover:bg-green-500 disabled:opacity-40 text-white font-semibold px-5 py-2.5 text-sm transition-colors"
            >
              ▶ Start
            </button>
          )}
          <button
            onClick={handleDraw}
            disabled={drawing || availableNumbers.length === 0}
            className="glass-panel rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-semibold px-5 py-2.5 text-sm transition-colors"
          >
            ⏭ Neste
          </button>
        </div>
      )}
    </div>
  );
}

/** Hex color from number (for inline CSS) */
const HEX_MAP: Record<number, string> = {
  0: '#ef4444', 1: '#d97706', 2: '#16a34a', 3: '#3b82f6', 4: '#8b5cf6',
};
function getHexForNumber(num: number): string {
  return HEX_MAP[Math.floor((num - 1) / 15)] ?? '#3b82f6';
}
