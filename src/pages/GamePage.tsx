import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { purchaseCoupon } from '@/services/actions';
import { submitBingoClaim } from '@/services/actions';
import { findWinCondition, countRemainingForWin } from '@/utils/bingoValidator';
import { GAME_STATUS_LABELS } from '@/utils/constants';
import { celebrateBingo, soundEffects } from '@/utils/effects';
import { CouponGrid } from '@/components/bingo/CouponGrid';
import { DrawnNumbers } from '@/components/bingo/DrawnNumbers';
import { BingoButton } from '@/components/bingo/BingoButton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';

export default function GamePage() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    location, game, coupons, loading, activeCouponIndex,
    initializeLocation, initializeGame, initializeUserCoupons, setActiveCouponIndex, reset,
  } = useGameStore();

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [commitmentAccepted, setCommitmentAccepted] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [claimingBingo, setClaimingBingo] = useState(false);

  // Reset store on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  // Initialize location listener
  useEffect(() => {
    if (!locationId) return;
    const unsub = initializeLocation(locationId);
    return unsub;
  }, [locationId, initializeLocation]);

  // Initialize game listener when location has active game
  useEffect(() => {
    if (!locationId || !location?.activeGameId) return;
    const unsub = initializeGame(locationId, location.activeGameId);
    return unsub;
  }, [locationId, location?.activeGameId, initializeGame]);

  // Initialize user coupons listener
  useEffect(() => {
    if (!locationId || !location?.activeGameId || !user?.uid) return;
    const unsub = initializeUserCoupons(locationId, location.activeGameId, user.uid);
    return unsub;
  }, [locationId, location?.activeGameId, user?.uid, initializeUserCoupons]);

  // Drawn numbers as Set for efficient lookup
  const drawnSet = useMemo(
    () => new Set(game?.drawnNumbers ?? []),
    [game?.drawnNumbers]
  );

  // Active coupon
  const activeCoupon = coupons[activeCouponIndex] ?? null;

  // Win condition check for active coupon
  const winResult = useMemo(() => {
    if (!activeCoupon || !game) return null;
    return findWinCondition(
      activeCoupon.numbers,
      drawnSet,
      game.winConditions
    );
  }, [activeCoupon, game, drawnSet]);

  // Remaining count for nearest win
  const remaining = useMemo(() => {
    if (!activeCoupon || !game) return 99;
    return countRemainingForWin(activeCoupon.numbers, drawnSet, game.winConditions);
  }, [activeCoupon, game, drawnSet]);

  // Track drawn numbers for sound effects
  const prevDrawnCountRef = useRef(0);
  const prevRemainingRef = useRef(99);
  const celebratedRef = useRef(false);

  useEffect(() => {
    const drawnCount = game?.drawnNumbers.length ?? 0;
    if (drawnCount > prevDrawnCountRef.current && prevDrawnCountRef.current > 0) {
      // A new number was drawn
      const latestNumber = game?.currentNumber ?? 0;
      const couponNumbers = activeCoupon?.numbers ?? [];
      if (couponNumbers.includes(latestNumber)) {
        soundEffects.play('match');
      } else {
        soundEffects.play('draw');
      }
    }
    prevDrawnCountRef.current = drawnCount;
  }, [game?.drawnNumbers.length, game?.currentNumber, activeCoupon?.numbers]);

  // Near-bingo sound (when 1 away)
  useEffect(() => {
    if (remaining === 1 && prevRemainingRef.current > 1) {
      soundEffects.play('nearBingo');
    }
    prevRemainingRef.current = remaining;
  }, [remaining]);

  // Confetti + fanfare when player wins
  useEffect(() => {
    if (activeCoupon?.isWinner && !celebratedRef.current) {
      celebratedRef.current = true;
      celebrateBingo();
      soundEffects.play('fanfare');
    }
    if (!activeCoupon?.isWinner) {
      celebratedRef.current = false;
    }
  }, [activeCoupon?.isWinner]);

  // Purchase handler
  async function handlePurchase() {
    if (!locationId || !location || !game || !user) return;
    if (!user.phone) {
      toast.error('Du må registrere telefonnummer på profilen din først');
      return;
    }
    setPurchasing(true);
    try {
      await purchaseCoupon(
        locationId,
        game.id,
        user.uid,
        user.displayName,
        user.phone,
        location.name,
        game.commitment
      );
      toast.success('Kupong kjøpt!');
      setShowPurchaseModal(false);
      setCommitmentAccepted(false);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Purchase error:', errMsg, error);
      toast.error(`Kunne ikke kjøpe kupong: ${errMsg}`);
    } finally {
      setPurchasing(false);
    }
  }

  // Bingo claim handler
  async function handleBingoClaim() {
    if (!locationId || !game || !user || !activeCoupon || !winResult) return;
    setClaimingBingo(true);
    try {
      await submitBingoClaim(
        locationId,
        game.id,
        user.uid,
        user.displayName,
        activeCoupon.id,
        winResult
      );
      toast.success('Bingo-rop sendt! Venter på godkjenning...');
    } catch (error) {
      console.error('Bingo claim error:', error);
      toast.error('Kunne ikke sende bingo-rop');
    } finally {
      setClaimingBingo(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <p className="text-gray-500">Lokasjon ikke funnet</p>
        <Button className="mt-4" onClick={() => navigate('/')}>Tilbake</Button>
      </div>
    );
  }

  const maxCoupons = location?.settings?.maxCouponsPerPlayer ?? 0;
  const atCouponLimit = maxCoupons > 0 && coupons.length >= maxCoupons;
  const missingPhone = !user?.phone;
  const canBuy = game?.status === 'open' && !atCouponLimit;
  const isActive = game?.status === 'active';
  const statusLabel = game ? GAME_STATUS_LABELS[game.status] ?? game.status : 'Ingen spill';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-bingo-600 text-sm">
            ← Tilbake
          </button>
          <h1 className="font-semibold text-gray-900 truncate mx-2">{location.name}</h1>
          <Badge variant={isActive ? 'success' : canBuy ? 'info' : 'default'}>
            {statusLabel}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* Missing phone number warning */}
        {missingPhone && game?.status === 'open' && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
            <p className="text-sm font-medium text-orange-800">
              Du må registrere telefonnummer før du kan kjøpe kuponger.
            </p>
            <button
              onClick={() => navigate('/profil')}
              className="mt-1 text-sm font-medium text-orange-600 underline hover:text-orange-800"
            >
              Gå til profilen din →
            </button>
          </div>
        )}

        {/* No active game */}
        {!game && (
          <Card className="text-center">
            <p className="text-gray-500">Ingen aktivt spill akkurat nå.</p>
            <p className="text-sm text-gray-400 mt-1">Vent til bingoverten starter et spill.</p>
          </Card>
        )}

        {/* Game open for purchase */}
        {game && canBuy && coupons.length === 0 && (
          <Card className="text-center">
            <p className="font-medium text-gray-900">Spillet er åpent for kupongkjøp!</p>
            <p className="text-sm text-gray-500 mt-1">Forpliktelse: {game.commitment}</p>
            <Button className="mt-4" onClick={() => setShowPurchaseModal(true)}>
              Kjøp kupong
            </Button>
          </Card>
        )}

        {/* Drawn numbers */}
        {game && isActive && game.drawnNumbers.length > 0 && (
          <Card padding="sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase">Siste trukne</span>
              <span className="text-xs text-gray-400">
                {game.drawnNumbers.length} av {game.totalNumbers}
              </span>
            </div>
            <DrawnNumbers numbers={game.drawnNumbers} />
          </Card>
        )}

        {/* Coupon tabs */}
        {coupons.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {coupons.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveCouponIndex(i)}
                className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  i === activeCouponIndex
                    ? 'bg-bingo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Kupong {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Active coupon */}
        {activeCoupon && (
          <Card>
            <CouponGrid
              numbers={activeCoupon.numbers}
              markedCells={activeCoupon.markedCells}
              drawnNumbers={drawnSet}
            />

            {/* Winner badge */}
            {activeCoupon.isWinner && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                <p className="font-bold text-green-700">🎉 BINGO! Du vant!</p>
              </div>
            )}
          </Card>
        )}

        {/* Buy more coupons button */}
        {game && game.status === 'open' && coupons.length > 0 && !atCouponLimit && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowPurchaseModal(true)}
          >
            Kjøp flere kuponger
          </Button>
        )}

        {/* Coupon limit reached */}
        {game && game.status === 'open' && atCouponLimit && (
          <p className="text-center text-sm text-gray-500">
            Du har kjøpt maks antall kuponger ({maxCoupons})
          </p>
        )}

        {/* Bingo button */}
        {game && isActive && activeCoupon && !activeCoupon.isWinner && (
          <BingoButton
            enabled={winResult !== null}
            loading={claimingBingo}
            onClick={handleBingoClaim}
            remaining={remaining}
          />
        )}

        {/* History link */}
        <button
          onClick={() => navigate(`/historikk/${locationId}`)}
          className="w-full text-center text-sm text-bingo-600 hover:underline mt-2"
        >
          Se tidligere spill →
        </button>
      </main>

      {/* Purchase modal */}
      <Modal
        open={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        title="Kjøp kupong"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-sm font-medium text-blue-800">Forpliktelse:</p>
            <p className="text-sm text-blue-600 mt-1">{game?.commitment}</p>
          </div>

          {missingPhone && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
              <p className="text-sm font-medium text-orange-800">
                Du må registrere telefonnummer før du kan kjøpe kuponger.
              </p>
              <button
                onClick={() => {
                  setShowPurchaseModal(false);
                  navigate('/profil');
                }}
                className="mt-1 text-sm font-medium text-orange-600 underline hover:text-orange-800"
              >
                Gå til profilen din →
              </button>
            </div>
          )}

          <p className="text-sm text-gray-500">
            Ved å kjøpe en kupong forplikter du deg til ovenstående.
            Ingen penger er involvert.
          </p>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={commitmentAccepted}
              onChange={(e) => setCommitmentAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-bingo-600 focus:ring-bingo-500"
            />
            <span className="text-sm text-gray-700">
              Jeg godtar forpliktelsen og ønsker å kjøpe 1 kupong
            </span>
          </label>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowPurchaseModal(false)}
            >
              Avbryt
            </Button>
            <Button
              className="flex-1"
              loading={purchasing}
              disabled={!commitmentAccepted || missingPhone}
              onClick={handlePurchase}
            >
              Bekreft kjøp
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
