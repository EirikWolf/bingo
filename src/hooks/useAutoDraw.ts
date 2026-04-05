import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { listenToLocation, listenToGame } from '@/services/firestore';
import { drawNumber } from '@/services/actions';
import { TOTAL_NUMBERS } from '@/utils/constants';
import type { Location, Game } from '@/types';

/**
 * Global auto-draw hook that runs in App.tsx.
 * Handles automatic number drawing for admins regardless of which page they are on.
 *
 * Uses refs for game/location state so the interval callback always reads
 * the latest Firestore data — avoiding stale-closure bugs.
 */
export function useAutoDraw() {
  const user = useAuthStore((s) => s.user);
  const [location, setLocation] = useState<Location | null>(null);
  const [game, setGame] = useState<Game | null>(null);

  const drawingRef = useRef(false);
  const autoDrawRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameRef = useRef<Game | null>(null);
  const locationRef = useRef<Location | null>(null);
  // Track numbers we've sent to Firestore but haven't received back yet
  const pendingNumbersRef = useRef<Set<number>>(new Set());

  // Keep refs in sync with state (updated every render)
  gameRef.current = game;
  locationRef.current = location;

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

  // Main auto-draw loop
  useEffect(() => {
    if (autoDrawRef.current) {
      clearInterval(autoDrawRef.current);
      autoDrawRef.current = null;
    }

    if (!shouldAutoDraw) return;

    const performDraw = async () => {
      // Read fresh state from refs every call
      const currentGame = gameRef.current;
      const currentLocation = locationRef.current;

      if (drawingRef.current || !currentLocation?.id || !currentGame) return;
      if (currentGame.status !== 'active' || !currentGame.autoDrawActive) return;

      // Combine server-confirmed drawn numbers with locally pending ones
      const drawn = new Set(currentGame.drawnNumbers ?? []);
      for (const n of pendingNumbersRef.current) {
        drawn.add(n);
      }

      if (drawn.size >= TOTAL_NUMBERS) return;

      const available = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1)
        .filter((n) => !drawn.has(n));
      if (available.length === 0) return;

      const number = available[Math.floor(Math.random() * available.length)]!;

      // Mark as pending before the async call
      pendingNumbersRef.current.add(number);
      drawingRef.current = true;

      try {
        await drawNumber(currentLocation.id, currentGame.id, number);
      } catch (error) {
        // Remove from pending on failure so it can be retried
        pendingNumbersRef.current.delete(number);
        console.error('[useAutoDraw] Draw error:', error);
      } finally {
        drawingRef.current = false;
      }
    };

    // Draw immediately on start, then at interval
    performDraw();

    autoDrawRef.current = setInterval(performDraw, intervalMs);

    return () => {
      if (autoDrawRef.current) {
        clearInterval(autoDrawRef.current);
        autoDrawRef.current = null;
      }
    };
  }, [shouldAutoDraw, intervalMs]);
}
