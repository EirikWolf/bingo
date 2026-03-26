import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { listenToLocation, listenToGame } from '@/services/firestore';
import { drawNumber } from '@/services/actions';
import { TOTAL_NUMBERS } from '@/utils/constants';
import type { Location, Game } from '@/types';

/**
 * Global auto-draw hook that runs in App.tsx.
 * Handles automatic number drawing for admins regardless of which page they are on.
 * This replaces the per-page auto-draw loops that broke when admins navigated between pages.
 */
export function useAutoDraw() {
  const user = useAuthStore((s) => s.user);
  const [location, setLocation] = useState<Location | null>(null);
  const [game, setGame] = useState<Game | null>(null);

  const drawingRef = useRef(false);
  const autoDrawRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen to user's active location
  useEffect(() => {
    if (!user?.activeLocationId) {
      setLocation(null);
      return;
    }
    const unsub = listenToLocation(user.activeLocationId, setLocation);
    return unsub;
  }, [user?.activeLocationId]);

  // Listen to active game
  useEffect(() => {
    if (!location?.id || !location.activeGameId) {
      setGame(null);
      return;
    }
    const unsub = listenToGame(location.id, location.activeGameId, setGame);
    return unsub;
  }, [location?.id, location?.activeGameId]);

  const isAdmin = user?.uid
    ? (location?.adminUids.includes(user.uid) ?? false)
    : false;

  const shouldAutoDraw =
    isAdmin &&
    game?.status === 'active' &&
    game?.autoDrawActive === true;

  const intervalMs = game?.autoDrawIntervalMs ?? 5000;

  const performDraw = useCallback(async () => {
    if (drawingRef.current || !location?.id || !game) return;

    const drawn = new Set(game.drawnNumbers ?? []);
    if (drawn.size >= TOTAL_NUMBERS) return;

    const available = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1)
      .filter((n) => !drawn.has(n));
    if (available.length === 0) return;

    const number = available[Math.floor(Math.random() * available.length)]!;

    drawingRef.current = true;
    try {
      await drawNumber(location.id, game.id, number);
    } catch (error) {
      console.error('[useAutoDraw] Draw error:', error);
    } finally {
      drawingRef.current = false;
    }
  }, [location?.id, game?.id, game?.drawnNumbers]);

  // Keep a ref to the latest draw function so the interval doesn't go stale
  const performDrawRef = useRef(performDraw);
  performDrawRef.current = performDraw;

  // Main auto-draw loop
  useEffect(() => {
    if (autoDrawRef.current) {
      clearInterval(autoDrawRef.current);
      autoDrawRef.current = null;
    }

    if (!shouldAutoDraw) return;

    // Draw immediately on start, then at interval
    performDrawRef.current();

    autoDrawRef.current = setInterval(() => {
      performDrawRef.current();
    }, intervalMs);

    return () => {
      if (autoDrawRef.current) {
        clearInterval(autoDrawRef.current);
        autoDrawRef.current = null;
      }
    };
  }, [shouldAutoDraw, intervalMs]);
}
