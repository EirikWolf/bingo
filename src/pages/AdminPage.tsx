import { Fragment, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { listenToLocation, listenToGame, listenToPendingClaims, listenToGameCoupons } from '@/services/firestore';
import { createGame, updateGameStatus, drawNumber, updateAutoDrawState, approveBingoClaim, rejectBingoClaim } from '@/services/actions';
import { TOTAL_NUMBERS, VALID_STATUS_TRANSITIONS, GAME_STATUS_LABELS, WIN_CONDITION_LABELS } from '@/utils/constants';
import { bingoSpeech, backgroundMusic } from '@/utils/speech';
import { soundEffects } from '@/utils/effects';
import { findWinCondition } from '@/utils/bingoValidator';
import { CouponGrid } from '@/components/bingo/CouponGrid';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { NumberBall } from '@/components/bingo/NumberBall';
import { CommitmentsTable } from '@/components/admin/CommitmentsTable';
import { SettingsPanel } from '@/components/admin/SettingsPanel';
import { PlayerOverview } from '@/components/admin/PlayerOverview';
import { QrCodeSection } from '@/components/admin/QrCodeSection';
import { LocationStatsCard } from '@/components/admin/LocationStatsCard';
import { Leaderboard } from '@/components/admin/Leaderboard';
import type { Location, Game, BingoClaim, Coupon, GameStatus, WinCondition } from '@/types';

type AdminTab = 'spill' | 'forpliktelser' | 'spillere' | 'statistikk' | 'innstillinger';

export default function AdminPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [location, setLocation] = useState<Location | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [claims, setClaims] = useState<BingoClaim[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // Game creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPaymentType, setNewPaymentType] = useState<'commitment' | 'vipps'>('commitment');
  const [newCommitment, setNewCommitment] = useState('');
  const [newWinConditions, setNewWinConditions] = useState<WinCondition[]>(['row', 'column', 'diagonal']);
  const [creating, setCreating] = useState(false);

  // Draw state
  const [drawing, setDrawing] = useState(false);
  const [autoDrawEnabled, setAutoDrawEnabled] = useState(false);
  const [autoDrawInterval, setAutoDrawInterval] = useState(5);
  const [countdown, setCountdown] = useState(0);
  const autoDrawRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Status transition
  const [transitioning, setTransitioning] = useState(false);

  // Claim review
  const [reviewingClaimId, setReviewingClaimId] = useState<string | null>(null);
  const [processingClaimId, setProcessingClaimId] = useState<string | null>(null);

  // Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('spill');

  // Speech state
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(0.9);
  const [speechVolume, setSpeechVolume] = useState(1.0);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Background music
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.15);

  // Sound effects
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [sfxVolume, setSfxVolume] = useState(0.5);

  // Track previous claims count for smart stop
  const prevClaimsCountRef = useRef(0);

  // Track previous currentNumber for speech announcement
  const prevCurrentNumberRef = useRef<number | null>(null);

  // Load voices
  useEffect(() => {
    function loadVoices() {
      const voices = bingoSpeech.getVoices();
      setAvailableVoices(voices);
      // Auto-select Norwegian voice if none selected
      if (!selectedVoiceURI) {
        const norwegian = bingoSpeech.getNorwegianVoices();
        if (norwegian.length > 0) {
          setSelectedVoiceURI(norwegian[0]!.voiceURI);
        }
      }
    }
    loadVoices();
    // Voices may load async
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceURI]);

  // Sync speech config
  useEffect(() => {
    bingoSpeech.setConfig({
      enabled: speechEnabled,
      voiceURI: selectedVoiceURI || null,
      rate: speechRate,
      volume: speechVolume,
    });
  }, [speechEnabled, selectedVoiceURI, speechRate, speechVolume]);

  // Load settings from location
  useEffect(() => {
    if (location?.settings.speech) {
      setSpeechEnabled(location.settings.speech.enabled);
      setSpeechRate(location.settings.speech.rate);
      setSpeechVolume(location.settings.speech.volume);
      if (location.settings.speech.voiceURI) {
        setSelectedVoiceURI(location.settings.speech.voiceURI);
      }
    }
    if (location?.settings.autoDrawIntervalMs) {
      setAutoDrawInterval(location.settings.autoDrawIntervalMs / 1000);
    }
    if (location?.settings.defaultCommitment) {
      setNewCommitment(location.settings.defaultCommitment);
    }
  }, [location?.settings.speech, location?.settings.autoDrawIntervalMs, location?.settings.defaultCommitment]);

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

  // Listen to pending claims
  useEffect(() => {
    if (!locationId || !location?.activeGameId) {
      setClaims([]);
      return;
    }
    const unsub = listenToPendingClaims(locationId, location.activeGameId, setClaims);
    return unsub;
  }, [locationId, location?.activeGameId]);

  // Listen to coupons
  useEffect(() => {
    if (!locationId || !location?.activeGameId) {
      setCoupons([]);
      return;
    }
    const unsub = listenToGameCoupons(locationId, location.activeGameId, setCoupons);
    return unsub;
  }, [locationId, location?.activeGameId]);

  // Smart stop: pause auto-draw when new bingo claim arrives
  useEffect(() => {
    if (claims.length > prevClaimsCountRef.current && autoDrawEnabled) {
      setAutoDrawEnabled(false);
      setCountdown(0);
      bingoSpeech.cancel();
      if (locationId && game) {
        updateAutoDrawState(locationId, game.id, false, autoDrawInterval * 1000);
      }
      const claimant = claims[0];
      if (claimant) {
        bingoSpeech.announceBingo(claimant.userDisplayName);
      }
      toast('Bingo-rop mottatt! Auto-trekning pauset.', { icon: '🔔' });
    }
    prevClaimsCountRef.current = claims.length;
  }, [claims, autoDrawEnabled, locationId, game, autoDrawInterval]);

  // NOTE: Speech announcements are handled by BigScreenPage only
  // to avoid double announcements when both are open in the same browser.
  // We still track currentNumber to update prevCurrentNumberRef.
  useEffect(() => {
    if (game?.currentNumber) {
      prevCurrentNumberRef.current = game.currentNumber;
    }
  }, [game?.currentNumber]);

  // Check admin access
  const isAdmin = user?.uid ? location?.adminUids.includes(user.uid) ?? false : false;

  // Available numbers to draw
  const availableNumbers = useMemo(() => {
    if (!game) return [];
    const drawn = new Set(game.drawnNumbers);
    const available: number[] = [];
    for (let i = 1; i <= TOTAL_NUMBERS; i++) {
      if (!drawn.has(i)) available.push(i);
    }
    return available;
  }, [game]);

  // Draw a random number
  const handleDraw = useCallback(async () => {
    if (!locationId || !game || availableNumbers.length === 0 || drawing) return;
    setDrawing(true);
    try {
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const number = availableNumbers[randomIndex]!;
      await drawNumber(locationId, game.id, number);
    } catch (error) {
      console.error('Draw error:', error);
      toast.error('Kunne ikke trekke tall');
    } finally {
      setDrawing(false);
    }
  }, [locationId, game, availableNumbers, drawing]);

  // Auto-draw with countdown
  useEffect(() => {
    // Clear existing timers
    if (autoDrawRef.current) {
      clearInterval(autoDrawRef.current);
      autoDrawRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (autoDrawEnabled && game?.status === 'active' && availableNumbers.length > 0) {
      const intervalMs = autoDrawInterval * 1000;
      let nextDrawTime = Date.now() + intervalMs;

      // Use real-time countdown to avoid drift in background tabs
      const tick = () => {
        const remaining = Math.max(0, Math.ceil((nextDrawTime - Date.now()) / 1000));
        setCountdown(remaining);
      };
      tick();

      // Countdown ticker (every second, time-based)
      countdownRef.current = setInterval(tick, 500);

      // Draw ticker
      autoDrawRef.current = setInterval(() => {
        handleDraw();
        nextDrawTime = Date.now() + intervalMs;
      }, intervalMs);
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
  }, [autoDrawEnabled, game?.status, availableNumbers.length, autoDrawInterval, handleDraw]);

  // Stop auto-draw when game is not active
  useEffect(() => {
    if (game?.status !== 'active') {
      setAutoDrawEnabled(false);
    }
  }, [game?.status]);

  // Sync sound effects settings
  useEffect(() => {
    soundEffects.setEnabled(sfxEnabled);
    soundEffects.setVolume(sfxVolume);
  }, [sfxEnabled, sfxVolume]);

  // Cleanup music on unmount
  useEffect(() => {
    return () => {
      backgroundMusic.stop();
      bingoSpeech.cancel();
    };
  }, []);

  // Create game handler
  async function handleCreateGame() {
    if (!locationId) return;
    setCreating(true);
    try {
      const commitment = newPaymentType === 'vipps'
        ? `Vipps-betaling: ${location?.settings.couponPricing?.pricePerCoupon ?? 0} kr`
        : newCommitment;
      await createGame(locationId, commitment, newWinConditions);
      toast.success('Spill opprettet!');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Create game error:', error);
      toast.error('Kunne ikke opprette spill');
    } finally {
      setCreating(false);
    }
  }

  // Status transition handler
  async function handleStatusTransition(newStatus: GameStatus) {
    if (!locationId || !game) return;

    // Confirm before finishing a game (irreversible)
    if (newStatus === 'finished') {
      const confirmed = window.confirm(
        'Er du sikker på at du vil avslutte spillet? Dette kan ikke angres.'
      );
      if (!confirmed) return;
    }

    setTransitioning(true);
    try {
      await updateGameStatus(locationId, game.id, newStatus, game.status);
      toast.success(`Status endret til ${GAME_STATUS_LABELS[newStatus]}`);
    } catch (error) {
      console.error('Status transition error:', error);
      toast.error('Kunne ikke endre status');
    } finally {
      setTransitioning(false);
    }
  }

  // Win condition toggle
  function toggleWinCondition(wc: WinCondition) {
    setNewWinConditions((prev) =>
      prev.includes(wc) ? prev.filter((c) => c !== wc) : [...prev, wc]
    );
  }

  // Background music toggle
  function toggleMusic() {
    if (musicPlaying) {
      backgroundMusic.stop();
      setMusicPlaying(false);
    } else {
      backgroundMusic.start(musicVolume);
      setMusicPlaying(true);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!location || !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <p className="text-gray-500">Ingen tilgang</p>
        <Button className="mt-4" onClick={() => navigate('/')}>Tilbake</Button>
      </div>
    );
  }

  const validTransitions = game ? (VALID_STATUS_TRANSITIONS[game.status] ?? []) : [];
  const norwegianVoices = availableVoices.filter(
    (v) => v.lang.startsWith('nb') || v.lang.startsWith('no') || v.lang.startsWith('nn')
  );
  const otherVoices = availableVoices.filter(
    (v) => !v.lang.startsWith('nb') && !v.lang.startsWith('no') && !v.lang.startsWith('nn')
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-bingo-600 text-sm">
            ← Tilbake
          </button>
          <h1 className="font-semibold text-gray-900 truncate mx-2">Admin: {location.name}</h1>
          <a
            href={`/skjerm/${locationId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-bingo-600 underline"
          >
            Storskjerm ↗
          </a>
        </div>
      </header>

      {/* Tab navigation */}
      <div className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-2xl flex">
          {([['spill', 'Spill'], ['forpliktelser', 'Forpliktelser'], ['spillere', 'Spillere'], ['statistikk', 'Statistikk'], ['innstillinger', 'Innstillinger']] as [AdminTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-bingo-600 border-b-2 border-bingo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
        {/* Commitments tab */}
        {activeTab === 'forpliktelser' && locationId && user && (
          <CommitmentsTable
            locationId={locationId}
            adminUid={user.uid}
            locationName={location.name}
            vippsNumber={location.settings.vippsNumber}
            vippsDefaultAmount={location.settings.vippsDefaultAmount}
          />
        )}

        {/* Players tab */}
        {activeTab === 'spillere' && locationId && (
          <PlayerOverview locationId={locationId} />
        )}

        {/* Statistics tab */}
        {activeTab === 'statistikk' && locationId && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Lokasjonsstatistikk</h2>
            <LocationStatsCard locationId={locationId} />
            <h2 className="text-lg font-semibold text-gray-900 mt-6">Toppliste</h2>
            <Leaderboard locationId={locationId} />
          </div>
        )}

        {/* Settings tab */}
        {activeTab === 'innstillinger' && locationId && (
          <SettingsPanel location={location} locationId={locationId} currentUserId={user?.uid ?? ''} />
        )}

        {/* Game tab */}
        {activeTab === 'spill' && (
        <Fragment>
        {/* No active game — create one */}
        {!game && (
          <Card className="text-center">
            <p className="text-gray-500 mb-4">Ingen aktivt spill</p>
            <Button onClick={() => setShowCreateModal(true)}>Opprett nytt spill</Button>
          </Card>
        )}

        {/* Game status card */}
        {game && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Spillstatus</h2>
              <Badge variant={game.status === 'active' ? 'success' : game.status === 'open' ? 'info' : 'default'}>
                {GAME_STATUS_LABELS[game.status]}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-gray-400">Kuponger</p>
                <p className="text-xl font-bold text-gray-900">{game.couponCount}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-gray-400">Trukket</p>
                <p className="text-xl font-bold text-gray-900">{game.drawnNumbers.length}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-gray-400">Igjen</p>
                <p className="text-xl font-bold text-gray-900">{availableNumbers.length}</p>
              </div>
            </div>

            {/* Status transitions */}
            {validTransitions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {validTransitions.map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === 'finished' ? 'danger' : 'secondary'}
                    loading={transitioning}
                    onClick={() => handleStatusTransition(status as GameStatus)}
                  >
                    → {GAME_STATUS_LABELS[status]}
                  </Button>
                ))}
              </div>
            )}

            {/* Guidance hints */}
            {game.status === 'setup' && (
              <p className="mt-2 text-xs text-gray-400">
                Trykk &quot;Åpent for kjøp&quot; for å la spillere kjøpe kuponger.
              </p>
            )}
            {game.status === 'open' && (
              <p className="mt-2 text-xs text-gray-400">
                Når nok spillere har kjøpt kuponger, trykk &quot;Aktiv&quot; for å starte trekningen.
              </p>
            )}
          </Card>
        )}

        {/* Draw control */}
        {game && game.status === 'active' && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Trekning</h2>

            {/* Current number */}
            {game.currentNumber && (
              <div className="flex justify-center mb-4">
                <NumberBall number={game.currentNumber} size="lg" animate />
              </div>
            )}

            {/* Countdown indicator */}
            {autoDrawEnabled && countdown > 0 && (
              <div className="mb-3 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-bingo-50 px-4 py-1.5">
                  <div className="h-2 w-2 rounded-full bg-bingo-500 animate-pulse" />
                  <span className="text-sm font-medium text-bingo-700">
                    Neste tall om {countdown}s
                  </span>
                </div>
              </div>
            )}

            {/* Draw buttons: Start auto / Pause / Next */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="lg"
                variant={autoDrawEnabled ? 'secondary' : 'primary'}
                disabled={availableNumbers.length === 0}
                onClick={() => {
                  setAutoDrawEnabled(true);
                  if (locationId && game) {
                    updateAutoDrawState(locationId, game.id, true, autoDrawInterval * 1000);
                  }
                  // Draw immediately when starting
                  if (!autoDrawEnabled) handleDraw();
                }}
                className={autoDrawEnabled ? 'opacity-50' : ''}
              >
                ▶ Start
              </Button>
              <Button
                size="lg"
                variant="secondary"
                disabled={!autoDrawEnabled}
                onClick={() => {
                  setAutoDrawEnabled(false);
                  setCountdown(0);
                  if (locationId && game) {
                    updateAutoDrawState(locationId, game.id, false, autoDrawInterval * 1000);
                  }
                }}
              >
                ⏸ Pause
              </Button>
              <Button
                size="lg"
                variant="primary"
                loading={drawing}
                disabled={availableNumbers.length === 0}
                onClick={() => {
                  // If auto-draw is on, reset countdown after manual draw
                  handleDraw();
                  if (autoDrawEnabled) setCountdown(autoDrawInterval);
                }}
              >
                ⏭ Neste
              </Button>
            </div>

            {/* Recent draws */}
            {game.drawnNumbers.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-2">Siste trukne tall:</p>
                <div className="flex flex-wrap gap-1.5">
                  {game.drawnNumbers
                    .slice(-10)
                    .reverse()
                    .map((num) => (
                      <NumberBall key={num} number={num} size="sm" />
                    ))}
                  {game.drawnNumbers.length > 10 && (
                    <span className="self-center text-xs text-gray-400">
                      +{game.drawnNumbers.length - 10} til
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Pending claims */}
        {claims.length > 0 && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Bingo-rop ({claims.length})
            </h2>
            <div className="space-y-3">
              {claims.map((claim) => {
                const claimCoupon = coupons.find((c) => c.id === claim.couponId);
                const drawnSet = new Set(game?.drawnNumbers ?? []);
                const serverValidation = claimCoupon
                  ? findWinCondition(claimCoupon.numbers, drawnSet, game?.winConditions ?? [])
                  : null;
                const isReviewing = reviewingClaimId === claim.id;

                return (
                  <div
                    key={claim.id}
                    className="rounded-lg bg-yellow-50 border border-yellow-200 p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{claim.userDisplayName}</p>
                        <p className="text-xs text-gray-500">
                          Påstår: {claim.suggestedWinCondition
                            ? WIN_CONDITION_LABELS[claim.suggestedWinCondition]
                            : 'Ukjent type'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {/* Server-side validation (from Cloud Function) */}
                        {claim.serverValidated ? (
                          claim.serverValidatedCondition ? (
                            <Badge variant="success">
                              Server: {WIN_CONDITION_LABELS[claim.serverValidatedCondition]}
                            </Badge>
                          ) : (
                            <Badge variant="error">Server: Ugyldig</Badge>
                          )
                        ) : null}
                        {/* Client-side validation (local check) */}
                        {serverValidation ? (
                          <Badge variant="success">Klient: {WIN_CONDITION_LABELS[serverValidation]}</Badge>
                        ) : (
                          <Badge variant="error">Klient: Ugyldig</Badge>
                        )}
                      </div>
                    </div>

                    {/* Show coupon preview */}
                    {claimCoupon && (
                      <button
                        onClick={() => setReviewingClaimId(isReviewing ? null : claim.id)}
                        className="text-xs text-bingo-600 underline mb-2"
                      >
                        {isReviewing ? 'Skjul kupong' : 'Vis kupong'}
                      </button>
                    )}

                    {isReviewing && claimCoupon && (
                      <div className="mb-3 max-w-[280px] mx-auto">
                        <CouponGrid
                          numbers={claimCoupon.numbers}
                          markedCells={claimCoupon.markedCells}
                          drawnNumbers={drawnSet}
                        />
                      </div>
                    )}

                    {/* Approve / Reject buttons */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={!serverValidation || processingClaimId === claim.id}
                        loading={processingClaimId === claim.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 focus:ring-green-500"
                        onClick={async () => {
                          if (!locationId || !game || !user || !serverValidation) return;
                          setProcessingClaimId(claim.id);
                          try {
                            await approveBingoClaim(
                              locationId,
                              game.id,
                              claim.id,
                              claim.couponId,
                              serverValidation,
                              claim.userId,
                              claim.userDisplayName,
                              user.uid
                            );
                            bingoSpeech.announceWinner(claim.userDisplayName);
                            toast.success(`Bingo godkjent for ${claim.userDisplayName}!`);
                          } catch (error) {
                            console.error('Approve error:', error);
                            toast.error('Kunne ikke godkjenne bingo');
                          } finally {
                            setProcessingClaimId(null);
                          }
                        }}
                      >
                        Godkjenn
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="flex-1"
                        disabled={processingClaimId === claim.id}
                        loading={processingClaimId === claim.id}
                        onClick={async () => {
                          if (!locationId || !game || !user) return;
                          setProcessingClaimId(claim.id);
                          try {
                            await rejectBingoClaim(
                              locationId,
                              game.id,
                              claim.id,
                              user.uid
                            );
                            toast('Bingo avvist', { icon: '❌' });
                          } catch (error) {
                            console.error('Reject error:', error);
                            toast.error('Kunne ikke avvise bingo');
                          } finally {
                            setProcessingClaimId(null);
                          }
                        }}
                      >
                        Avvis
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Sound & Speech settings — always visible so admin can test before game starts */}
        {location && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Lyd og stemme</h2>

            {/* Speech enabled toggle */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-700">Stemme-annonsering</span>
              <button
                role="switch"
                aria-checked={speechEnabled}
                onClick={() => setSpeechEnabled(!speechEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  speechEnabled ? 'bg-bingo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    speechEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {speechEnabled && (
              <div className="space-y-3">
                {/* Voice selector */}
                <div>
                  <label htmlFor="voice-select" className="block text-xs text-gray-500 mb-1">
                    Stemme
                  </label>
                  <select
                    id="voice-select"
                    value={selectedVoiceURI}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none"
                  >
                    <option value="">Standard</option>
                    {norwegianVoices.length > 0 && (
                      <optgroup label="Norsk">
                        {norwegianVoices.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {otherVoices.length > 0 && (
                      <optgroup label="Andre">
                        {otherVoices.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Speech rate */}
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Hastighet</span>
                    <span>{speechRate.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(Number(e.target.value))}
                    className="w-full accent-bingo-600"
                  />
                </div>

                {/* Speech volume */}
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Volum</span>
                    <span>{Math.round(speechVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={speechVolume}
                    onChange={(e) => setSpeechVolume(Number(e.target.value))}
                    className="w-full accent-bingo-600"
                  />
                </div>

                {/* Test button */}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => bingoSpeech.test()}
                >
                  Test stemme
                </Button>
              </div>
            )}

            {/* Sound effects */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Lydeffekter (spillere)</span>
                <button
                  role="switch"
                  aria-checked={sfxEnabled}
                  onClick={() => setSfxEnabled(!sfxEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    sfxEnabled ? 'bg-bingo-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      sfxEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {sfxEnabled && (
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Volum</span>
                    <span>{Math.round(sfxVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={sfxVolume}
                    onChange={(e) => setSfxVolume(Number(e.target.value))}
                    className="w-full accent-bingo-600"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-1"
                    onClick={() => soundEffects.play('match')}
                  >
                    Test lydeffekt
                  </Button>
                </div>
              )}
            </div>

            {/* Background music */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Bakgrunnsmusikk</span>
                <Button
                  size="sm"
                  variant={musicPlaying ? 'danger' : 'secondary'}
                  onClick={toggleMusic}
                >
                  {musicPlaying ? '⏹ Stopp' : '♫ Spill'}
                </Button>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Volum</span>
                  <span>{Math.round(musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMusicVolume(v);
                    backgroundMusic.setVolume(v);
                  }}
                  className="w-full accent-bingo-600"
                />
              </div>
            </div>

            {/* Auto-draw interval slider */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="draw-interval" className="text-gray-600">
                  Auto-trekning intervall
                </label>
                <span className="font-medium text-gray-900">{autoDrawInterval}s</span>
              </div>
              <input
                id="draw-interval"
                type="range"
                min="3"
                max="30"
                step="1"
                value={autoDrawInterval}
                onChange={(e) => setAutoDrawInterval(Number(e.target.value))}
                className="mt-1 w-full accent-bingo-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>3s</span>
                <span>30s</span>
              </div>
            </div>

            {!bingoSpeech.isAvailable() && (
              <p className="mt-2 text-xs text-red-500">
                Nettleseren støtter ikke tale-syntetisering.
              </p>
            )}
          </Card>
        )}

        {/* Coupon list */}
        {game && coupons.length > 0 && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Kuponger ({coupons.length})
            </h2>
            <div className="space-y-1">
              {coupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="text-gray-700">{coupon.userDisplayName}</span>
                  {coupon.isWinner && <Badge variant="success">Vinner</Badge>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* QR code for player access */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">QR-kode for spillere</h2>
          <QrCodeSection locationId={locationId!} locationName={location.name} />
        </Card>
        </Fragment>
        )}
      </main>

      {/* Create game modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Opprett nytt spill"
      >
        <div className="space-y-4">
          {/* Payment type selection */}
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Betalingsmåte</p>
            <div className="space-y-2">
              <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                newPaymentType === 'commitment' ? 'border-bingo-500 bg-bingo-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="paymentType"
                  checked={newPaymentType === 'commitment'}
                  onChange={() => setNewPaymentType('commitment')}
                  className="mt-0.5 h-4 w-4 text-bingo-600 focus:ring-bingo-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Forpliktelse (dugnad)</p>
                  <p className="text-xs text-gray-500">Spillere forplikter seg til en tjeneste</p>
                </div>
              </label>

              {location?.settings.couponPricing?.enabled && location?.settings.vippsNumber ? (
                <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  newPaymentType === 'vipps' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="paymentType"
                    checked={newPaymentType === 'vipps'}
                    onChange={() => setNewPaymentType('vipps')}
                    className="mt-0.5 h-4 w-4 text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Vipps-betaling — {location.settings.couponPricing.pricePerCoupon} kr per kupong
                    </p>
                    <p className="text-xs text-gray-500">Spillere betaler via Vipps</p>
                  </div>
                </label>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 p-3 flex items-center justify-between">
                  <p className="text-xs text-gray-400">Vipps er ikke konfigurert</p>
                  <button
                    onClick={() => { setShowCreateModal(false); setActiveTab('innstillinger'); }}
                    className="text-xs text-bingo-600 hover:underline whitespace-nowrap ml-2"
                  >
                    Konfigurer →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Commitment text - only shown for commitment type */}
          {newPaymentType === 'commitment' && (
            <div>
              <label htmlFor="commitment" className="block text-sm font-medium text-gray-700 mb-1">
                Forpliktelse
              </label>
              <input
                id="commitment"
                type="text"
                value={newCommitment}
                onChange={(e) => setNewCommitment(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none focus:ring-1 focus:ring-bingo-500"
                placeholder={location?.settings.defaultCommitment || 'F.eks. 1 time dugnad per kupong'}
              />
            </div>
          )}

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Gevinsttyper</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(WIN_CONDITION_LABELS) as [WinCondition, string][]).map(([wc, label]) => (
                <button
                  key={wc}
                  onClick={() => toggleWinCondition(wc)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    newWinConditions.includes(wc)
                      ? 'bg-bingo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowCreateModal(false)}
            >
              Avbryt
            </Button>
            <Button
              className="flex-1"
              loading={creating}
              disabled={(newPaymentType === 'commitment' && !newCommitment.trim()) || newWinConditions.length === 0}
              onClick={handleCreateGame}
            >
              Opprett
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
