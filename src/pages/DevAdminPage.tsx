import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  seedAllData,
  clearAllData,
  simulateDrawing,
  simulateBingoClaim,
  getCollectionCounts,
  SEED_LOCATIONS,
  SEED_GAMES,
  SEED_PLAYERS,
  type CollectionCounts,
} from '@/services/seed';

type Tab = 'overview' | 'draw' | 'bingo' | 'users';

export default function DevAdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Redirect if not in dev mode
  if (!import.meta.env.DEV) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-red-600 font-semibold">Kun tilgjengelig i utviklingsmodus</p>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Oversikt' },
    { id: 'draw', label: 'Simuler trekning' },
    { id: 'bingo', label: 'Simuler Bingo' },
    { id: 'users', label: 'Testbrukere' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-orange-600 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Dev Admin</h1>
            <p className="text-xs text-orange-200">Testdata og utviklingsverktoy</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="rounded-lg bg-orange-700 px-3 py-1.5 text-sm hover:bg-orange-800"
          >
            Tilbake
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl p-4 space-y-4">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'draw' && <DrawTab />}
        {activeTab === 'bingo' && <BingoTab />}
        {activeTab === 'users' && <UsersTab />}
      </div>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────

function OverviewTab() {
  const [counts, setCounts] = useState<CollectionCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev, msg]);
  }, []);

  const refreshCounts = useCallback(async () => {
    try {
      const c = await getCollectionCounts();
      setCounts(c);
    } catch (error) {
      console.error('Count error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  async function handleSeed() {
    setSeeding(true);
    setLog([]);
    try {
      await seedAllData(addLog);
      toast.success('Testdata opprettet!');
      await refreshCounts();
    } catch (error) {
      console.error('Seed error:', error);
      toast.error('Feil under seed');
      addLog(`FEIL: ${error}`);
    } finally {
      setSeeding(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    setLog([]);
    try {
      await clearAllData(addLog);
      toast.success('Alt slettet!');
      await refreshCounts();
    } catch (error) {
      console.error('Clear error:', error);
      toast.error('Feil under sletting');
      addLog(`FEIL: ${error}`);
    } finally {
      setClearing(false);
    }
  }

  async function handleResetAndSeed() {
    setSeeding(true);
    setLog([]);
    try {
      await clearAllData(addLog);
      addLog('--- Starter seed ---');
      await seedAllData(addLog);
      toast.success('Nullstilt og seedet!');
      await refreshCounts();
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Feil under nullstilling');
      addLog(`FEIL: ${error}`);
    } finally {
      setSeeding(false);
    }
  }

  const totalGames = counts ? Object.values(counts.games).reduce((a, b) => a + b, 0) : 0;
  const totalCoupons = counts ? Object.values(counts.coupons).reduce((a, b) => a + b, 0) : 0;
  const totalClaims = counts ? Object.values(counts.claims).reduce((a, b) => a + b, 0) : 0;

  return (
    <Fragment>
      {/* Stats */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Dokumenter i Firestore</h3>
        {loading ? (
          <p className="text-gray-400 text-sm">Teller...</p>
        ) : counts ? (
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-gray-400 text-xs">Brukere</p>
              <p className="text-lg font-bold text-gray-900">{counts.users}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-gray-400 text-xs">Lokasjoner</p>
              <p className="text-lg font-bold text-gray-900">{counts.locations}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-gray-400 text-xs">Spill</p>
              <p className="text-lg font-bold text-gray-900">{totalGames}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-gray-400 text-xs">Kuponger</p>
              <p className="text-lg font-bold text-gray-900">{totalCoupons}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-gray-400 text-xs">Forpliktelser</p>
              <p className="text-lg font-bold text-gray-900">{counts.commitments}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-gray-400 text-xs">Bingo-krav</p>
              <p className="text-lg font-bold text-gray-900">{totalClaims}</p>
            </div>
          </div>
        ) : (
          <p className="text-red-500 text-sm">Kunne ikke hente tall</p>
        )}
      </Card>

      {/* Actions */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Handlinger</h3>
        <div className="space-y-2">
          <Button
            onClick={handleSeed}
            loading={seeding}
            disabled={clearing}
            className="w-full bg-green-600 hover:bg-green-700 focus:ring-green-500"
          >
            Seed testdata
          </Button>
          <Button
            onClick={handleResetAndSeed}
            loading={seeding}
            disabled={clearing}
            className="w-full bg-orange-600 hover:bg-orange-700 focus:ring-orange-500"
          >
            Nullstill + seed
          </Button>
          <Button
            onClick={handleClear}
            loading={clearing}
            disabled={seeding}
            variant="secondary"
            className="w-full"
          >
            Slett alt
          </Button>
          <Button
            onClick={refreshCounts}
            variant="ghost"
            className="w-full"
          >
            Oppdater tellere
          </Button>
        </div>
      </Card>

      {/* Log */}
      {log.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Logg</h3>
          <div className="max-h-64 overflow-y-auto rounded-lg bg-gray-900 p-3 text-xs text-green-400 font-mono space-y-0.5">
            {log.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </Card>
      )}
    </Fragment>
  );
}

// ─── Draw Simulation Tab ─────────────────────────────────

function DrawTab() {
  const [locationId, setLocationId] = useState(SEED_LOCATIONS[0]?.id ?? '');
  const [gameId, setGameId] = useState('');
  const [count, setCount] = useState(5);
  const [drawing, setDrawing] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const availableGames = SEED_GAMES[locationId] ?? [];

  useEffect(() => {
    const first = availableGames[0];
    if (first) setGameId(first.id);
    else setGameId('');
  }, [locationId]);

  async function handleDraw() {
    if (!locationId || !gameId) {
      toast.error('Velg lokasjon og spill');
      return;
    }
    setDrawing(true);
    setLog([]);
    try {
      await simulateDrawing(locationId, gameId, count, (msg) => {
        setLog((prev) => [...prev, msg]);
      });
      toast.success(`${count} tall trukket`);
    } catch (error) {
      console.error('Draw error:', error);
      toast.error('Feil under trekning');
    } finally {
      setDrawing(false);
    }
  }

  return (
    <Fragment>
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Simuler trekning</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="draw-location" className="block text-sm text-gray-600 mb-1">Lokasjon</label>
            <select
              id="draw-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              {SEED_LOCATIONS.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="draw-game" className="block text-sm text-gray-600 mb-1">Spill</label>
            <select
              id="draw-game"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              disabled={availableGames.length === 0}
            >
              {availableGames.length === 0 && (
                <option value="">Ingen spill</option>
              )}
              {availableGames.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="draw-count" className="block text-sm text-gray-600 mb-1">
              Antall tall: <span className="font-semibold text-orange-600">{count}</span>
            </label>
            <input
              id="draw-count"
              type="range"
              min={1}
              max={30}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-orange-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>1</span>
              <span>30</span>
            </div>
          </div>

          <Button
            onClick={handleDraw}
            loading={drawing}
            disabled={!gameId}
            className="w-full bg-orange-600 hover:bg-orange-700 focus:ring-orange-500"
          >
            Trekk {count} tall
          </Button>
        </div>
      </Card>

      {log.length > 0 && (
        <Card>
          <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-900 p-3 text-xs text-green-400 font-mono space-y-0.5">
            {log.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </Card>
      )}
    </Fragment>
  );
}

// ─── Bingo Simulation Tab ────────────────────────────────

function BingoTab() {
  const [locationId, setLocationId] = useState(SEED_LOCATIONS[0]?.id ?? '');
  const [gameId, setGameId] = useState('');
  const [playerId, setPlayerId] = useState(SEED_PLAYERS[0]?.uid ?? '');
  const [couponId, setCouponId] = useState('');
  const [sending, setSending] = useState(false);

  const availableGames = SEED_GAMES[locationId] ?? [];
  const selectedPlayer = SEED_PLAYERS.find((p) => p.uid === playerId);

  useEffect(() => {
    const first = availableGames[0];
    if (first) setGameId(first.id);
    else setGameId('');
  }, [locationId]);

  async function handleSendClaim() {
    if (!locationId || !gameId || !playerId) {
      toast.error('Velg lokasjon, spill og spiller');
      return;
    }
    setSending(true);
    try {
      await simulateBingoClaim(
        locationId,
        gameId,
        playerId,
        selectedPlayer?.displayName ?? 'Ukjent',
        couponId || `coupon-auto-${Date.now()}`,
        (msg) => toast.success(msg)
      );
    } catch (error) {
      console.error('Bingo claim error:', error);
      toast.error('Feil under bingo-rop');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Simuler Bingo-rop</h3>
      <div className="space-y-3">
        <div>
          <label htmlFor="bingo-location" className="block text-sm text-gray-600 mb-1">Lokasjon</label>
          <select
            id="bingo-location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            {SEED_LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bingo-game" className="block text-sm text-gray-600 mb-1">Spill</label>
          <select
            id="bingo-game"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            disabled={availableGames.length === 0}
          >
            {availableGames.length === 0 && (
              <option value="">Ingen spill</option>
            )}
            {availableGames.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bingo-player" className="block text-sm text-gray-600 mb-1">Spiller</label>
          <select
            id="bingo-player"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            {SEED_PLAYERS.map((p) => (
              <option key={p.uid} value={p.uid}>{p.displayName}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bingo-coupon" className="block text-sm text-gray-600 mb-1">
            Kupong-ID (valgfritt)
          </label>
          <input
            id="bingo-coupon"
            type="text"
            value={couponId}
            onChange={(e) => setCouponId(e.target.value)}
            placeholder="coupon-tarjei-1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>

        <Button
          onClick={handleSendClaim}
          loading={sending}
          disabled={!gameId}
          className="w-full bg-orange-600 hover:bg-orange-700 focus:ring-orange-500"
        >
          Send Bingo-rop
        </Button>
      </div>
    </Card>
  );
}

// ─── Users Tab ───────────────────────────────────────────

function UsersTab() {
  const users = [
    { uid: 'user-admin-gneist', name: 'Kari Nordmann', role: 'admin', email: 'kari@test.no', location: 'Gneist' },
    { uid: 'user-admin-aurora', name: 'Per Hansen', role: 'admin', email: 'per@test.no', location: 'Aurora' },
    { uid: 'user-super', name: 'Admin Superbruker', role: 'superadmin', email: 'super@test.no', location: '—' },
    { uid: 'user-player-1', name: 'Ole Olsen', role: 'player', email: 'ole@test.no', location: 'Gneist' },
    { uid: 'user-player-2', name: 'Lisa Berg', role: 'player', email: 'lisa@test.no', location: 'Gneist' },
    { uid: 'user-player-3', name: 'Mona Lie', role: 'player', email: 'mona@test.no', location: 'Aurora' },
    { uid: 'user-player-4', name: 'Tarjei Vik', role: 'player', email: 'tarjei@test.no', location: 'Gneist' },
    { uid: 'user-player-5', name: 'Ingrid Dahl', role: 'player', email: 'ingrid@test.no', location: '— (inaktiv)' },
  ];

  const roleColors: Record<string, string> = {
    admin: 'bg-blue-100 text-blue-700',
    superadmin: 'bg-purple-100 text-purple-700',
    player: 'bg-gray-100 text-gray-700',
  };

  return (
    <Card padding="none">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Testbrukere</h3>
        <p className="text-xs text-gray-400 mt-0.5">Alle har passord: test1234</p>
      </div>
      <div className="divide-y divide-gray-50">
        {users.map((u) => (
          <div key={u.uid} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
              <p className="text-xs text-gray-400">{u.email}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[u.role] ?? ''}`}>
              {u.role}
            </span>
            <span className="text-xs text-gray-400 hidden sm:inline">{u.location}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
