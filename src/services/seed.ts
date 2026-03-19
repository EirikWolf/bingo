/**
 * Seed service — populates Firestore emulator with test data.
 * Only used in dev mode via /dev-admin.
 */
import {
  doc,
  setDoc,
  writeBatch,
  collection,
  getDocs,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { generateCouponNumbers, createEmptyMarkedGrid } from '@/utils/couponGenerator';
import { COLUMN_RANGES } from '@/utils/constants';
import type { GameStatus, WinCondition } from '@/types';

// ─── Test users ──────────────────────────────────────────

interface TestUser {
  uid: string;
  displayName: string;
  email: string;
  phone: string | null;
  role: 'player' | 'admin' | 'superadmin';
}

const TEST_USERS: TestUser[] = [
  { uid: 'user-admin-gneist', displayName: 'Kari Nordmann', email: 'kari@test.no', phone: '99887766', role: 'admin' },
  { uid: 'user-admin-aurora', displayName: 'Per Hansen', email: 'per@test.no', phone: '99776655', role: 'admin' },
  { uid: 'user-super', displayName: 'Admin Superbruker', email: 'super@test.no', phone: null, role: 'superadmin' },
  { uid: 'user-player-1', displayName: 'Ole Olsen', email: 'ole@test.no', phone: '91234567', role: 'player' },
  { uid: 'user-player-2', displayName: 'Lisa Berg', email: 'lisa@test.no', phone: '92345678', role: 'player' },
  { uid: 'user-player-3', displayName: 'Mona Lie', email: 'mona@test.no', phone: '93456789', role: 'player' },
  { uid: 'user-player-4', displayName: 'Tarjei Vik', email: 'tarjei@test.no', phone: '94567890', role: 'player' },
  { uid: 'user-player-5', displayName: 'Ingrid Dahl', email: 'ingrid@test.no', phone: '95678901', role: 'player' },
];

// ─── Location IDs ────────────────────────────────────────

const LOC_GNEIST = 'loc-gneist';
const LOC_AURORA = 'loc-aurora';
const LOC_FRISK = 'loc-frisk';

// ─── Game IDs ────────────────────────────────────────────

const GAME_GNEIST_ACTIVE = 'game-gneist-active';
const GAME_GNEIST_FINISHED = 'game-gneist-finished';
const GAME_AURORA_ACTIVE = 'game-aurora-active';

// ─── Drawn numbers for test games ────────────────────────

const GNEIST_DRAWN = [7, 22, 35, 42, 47, 48, 51, 56, 61, 68, 72, 3, 12, 28];
const GNEIST_FINISHED_DRAWN = [4, 17, 33, 46, 62, 8, 21, 38, 54, 71, 2, 29, 41, 59, 65, 11, 24, 37, 48, 73];

// ─── Helpers ─────────────────────────────────────────────

function daysAgo(days: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() - days * 86400000));
}

/**
 * Generate a coupon where row 2 (indices 10-14) is almost complete:
 * all numbers in row 2 exist in drawnNumbers except one.
 */
function generateNearBingoCoupon(drawnNumbers: number[]): number[] {
  const grid = generateCouponNumbers();
  const drawnSet = new Set(drawnNumbers);

  // For row 2 (indices 10,11,12,13,14), make 4 of 5 cells match drawn numbers.
  // Index 12 is free cell (always 0), so we need indices 10,11,13,14 to have 3 matched + 1 not.
  const row2Indices = [10, 11, 13, 14]; // skip 12 (free cell)

  for (let i = 0; i < row2Indices.length; i++) {
    const idx = row2Indices[i]!;
    const col = idx % 5;
    const range = COLUMN_RANGES[col]!;

    if (i < 3) {
      // Make this cell match a drawn number in same column
      const matchingDrawn = drawnNumbers.filter(
        (n) => n >= range.min && n <= range.max && !grid.includes(n)
      );
      if (matchingDrawn.length > 0) {
        grid[idx] = matchingDrawn[0]!;
      }
    } else {
      // Make this cell NOT match any drawn number
      let val = range.min;
      while (drawnSet.has(val) || grid.includes(val)) {
        val++;
        if (val > range.max) break;
      }
      if (val <= range.max) {
        grid[idx] = val;
      }
    }
  }

  return grid;
}

// ─── Clear all data ──────────────────────────────────────

async function clearCollection(path: string): Promise<number> {
  const snap = await getDocs(collection(db, path));
  let count = 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.delete(d.ref);
    count++;
  });
  if (count > 0) await batch.commit();
  return count;
}

export async function clearAllData(onProgress?: (msg: string) => void): Promise<void> {
  const log = onProgress ?? console.log;

  // Clear subcollections for known locations/games
  const locationIds = [LOC_GNEIST, LOC_AURORA, LOC_FRISK];
  const gameIds: Record<string, string[]> = {
    [LOC_GNEIST]: [GAME_GNEIST_ACTIVE, GAME_GNEIST_FINISHED],
    [LOC_AURORA]: [GAME_AURORA_ACTIVE],
    [LOC_FRISK]: [],
  };

  for (const locId of locationIds) {
    const games = gameIds[locId] ?? [];
    for (const gameId of games) {
      const coupons = await clearCollection(`locations/${locId}/games/${gameId}/coupons`);
      log(`Slettet ${coupons} kuponger fra ${locId}/${gameId}`);
      const claims = await clearCollection(`locations/${locId}/games/${gameId}/bingo_claims`);
      log(`Slettet ${claims} bingo-krav fra ${locId}/${gameId}`);
    }
    const gameCount = await clearCollection(`locations/${locId}/games`);
    log(`Slettet ${gameCount} spill fra ${locId}`);
  }

  // Also try to find any other locations/games
  const locSnap = await getDocs(collection(db, 'locations'));
  for (const locDoc of locSnap.docs) {
    if (!locationIds.includes(locDoc.id)) {
      const gamesSnap = await getDocs(collection(db, 'locations', locDoc.id, 'games'));
      for (const gameDoc of gamesSnap.docs) {
        await clearCollection(`locations/${locDoc.id}/games/${gameDoc.id}/coupons`);
        await clearCollection(`locations/${locDoc.id}/games/${gameDoc.id}/bingo_claims`);
      }
      await clearCollection(`locations/${locDoc.id}/games`);
    }
    await deleteDoc(locDoc.ref);
  }
  log(`Slettet ${locSnap.size} lokasjoner`);

  const commitments = await clearCollection('commitments');
  log(`Slettet ${commitments} forpliktelser`);

  const users = await clearCollection('users');
  log(`Slettet ${users} brukere`);

  log('Alt slettet!');
}

// ─── Seed all data ───────────────────────────────────────

export async function seedAllData(onProgress?: (msg: string) => void): Promise<void> {
  const log = onProgress ?? console.log;

  // 1. Create users
  log('Oppretter testbrukere...');
  for (const u of TEST_USERS) {
    await setDoc(doc(db, 'users', u.uid), {
      uid: u.uid,
      displayName: u.displayName,
      email: u.email,
      phone: u.phone,
      photoURL: null,
      role: u.role,
      activeLocationId: null,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });
  }
  log(`${TEST_USERS.length} brukere opprettet`);

  // 2. Create locations
  log('Oppretter lokasjoner...');

  const defaultSpeech = {
    enabled: true,
    voiceURI: null,
    rate: 0.9,
    volume: 1.0,
  };

  await setDoc(doc(db, 'locations', LOC_GNEIST), {
    name: 'Idrettslaget Gneist',
    description: 'Bingo hver onsdag kl. 19:00',
    imageURL: null,
    pinCode: null,
    adminUids: ['user-admin-gneist'],
    activeGameId: GAME_GNEIST_ACTIVE,
    settings: {
      maxCouponsPerPlayer: 5,
      defaultCommitment: '1 time dugnad per kupong',
      commitmentLevels: [],
      allowAnonymous: false,
      autoDrawEnabled: false,
      autoDrawIntervalMs: 5000,
      winConditions: ['row', 'column', 'diagonal'] as WinCondition[],
      vippsNumber: '12345678',
      vippsDefaultAmount: 50,
      reminderEnabled: false,
      speech: defaultSpeech,
    },
    playerCount: 4,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'locations', LOC_AURORA), {
    name: 'Kulturhuset Aurora',
    description: 'Bingokveld forste fredag i maneden',
    imageURL: null,
    pinCode: null,
    adminUids: ['user-admin-aurora'],
    activeGameId: GAME_AURORA_ACTIVE,
    settings: {
      maxCouponsPerPlayer: 3,
      defaultCommitment: 'Bake kake til neste arrangement',
      commitmentLevels: [],
      allowAnonymous: false,
      autoDrawEnabled: false,
      autoDrawIntervalMs: 5000,
      winConditions: ['row', 'column', 'diagonal', 'full_board'] as WinCondition[],
      vippsNumber: null,
      vippsDefaultAmount: null,
      reminderEnabled: false,
      speech: defaultSpeech,
    },
    playerCount: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'locations', LOC_FRISK), {
    name: 'Sportsklubben Frisk',
    description: 'Sesongavslutning — bingo!',
    imageURL: null,
    pinCode: null,
    adminUids: ['user-super'],
    activeGameId: null,
    settings: {
      maxCouponsPerPlayer: 0,
      defaultCommitment: '1 time dugnad per kupong',
      commitmentLevels: [],
      allowAnonymous: false,
      autoDrawEnabled: false,
      autoDrawIntervalMs: 5000,
      winConditions: ['row', 'column', 'diagonal'] as WinCondition[],
      vippsNumber: null,
      vippsDefaultAmount: null,
      reminderEnabled: false,
      speech: defaultSpeech,
    },
    playerCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  log('3 lokasjoner opprettet');

  // 3. Create games
  log('Oppretter spill...');

  // Gneist active game
  await setDoc(doc(db, 'locations', LOC_GNEIST, 'games', GAME_GNEIST_ACTIVE), {
    status: 'active' as GameStatus,
    drawnNumbers: GNEIST_DRAWN,
    currentNumber: 28,
    totalNumbers: 75,
    winConditions: ['row', 'column', 'diagonal'] as WinCondition[],
    winners: [],
    couponCount: 6,
    playerCount: 3,
    commitment: '1 time dugnad — loppemarked 5. april',
    autoDrawActive: false,
    autoDrawIntervalMs: 5000,
    lastDrawAt: null,
    createdAt: daysAgo(0),
    startedAt: daysAgo(0),
    finishedAt: null,
  });

  // Gneist finished game
  await setDoc(doc(db, 'locations', LOC_GNEIST, 'games', GAME_GNEIST_FINISHED), {
    status: 'finished' as GameStatus,
    drawnNumbers: GNEIST_FINISHED_DRAWN,
    currentNumber: 73,
    totalNumbers: 75,
    winConditions: ['row', 'column', 'diagonal'] as WinCondition[],
    winners: [{
      userId: 'user-player-1',
      displayName: 'Ole Olsen',
      couponId: 'coupon-ole-hist',
      winCondition: 'row' as WinCondition,
    }],
    couponCount: 4,
    playerCount: 2,
    commitment: 'Vaske garderober',
    autoDrawActive: false,
    autoDrawIntervalMs: 5000,
    lastDrawAt: null,
    createdAt: daysAgo(7),
    startedAt: daysAgo(7),
    finishedAt: daysAgo(7),
  });

  // Aurora active game (open for purchase)
  await setDoc(doc(db, 'locations', LOC_AURORA, 'games', GAME_AURORA_ACTIVE), {
    status: 'open' as GameStatus,
    drawnNumbers: [],
    currentNumber: null,
    totalNumbers: 75,
    winConditions: ['row', 'column', 'diagonal', 'full_board'] as WinCondition[],
    winners: [],
    couponCount: 1,
    playerCount: 1,
    commitment: 'Bake kake til neste arrangement',
    autoDrawActive: false,
    autoDrawIntervalMs: 5000,
    lastDrawAt: null,
    createdAt: daysAgo(0),
    startedAt: null,
    finishedAt: null,
  });
  log('3 spill opprettet');

  // 4. Create coupons for Gneist active game
  log('Oppretter kuponger...');

  // Ole: 2 coupons (one near-bingo)
  const oleNearBingo = generateNearBingoCoupon(GNEIST_DRAWN);
  await setDoc(
    doc(db, 'locations', LOC_GNEIST, 'games', GAME_GNEIST_ACTIVE, 'coupons', 'coupon-ole-1'),
    {
      userId: 'user-player-1',
      userDisplayName: 'Ole Olsen',
      numbers: oleNearBingo,
      markedCells: createEmptyMarkedGrid(),
      commitmentId: 'commitment-ole-1',
      isWinner: false,
      winCondition: null,
      purchasedAt: daysAgo(0),
    }
  );
  await setDoc(
    doc(db, 'locations', LOC_GNEIST, 'games', GAME_GNEIST_ACTIVE, 'coupons', 'coupon-ole-2'),
    {
      userId: 'user-player-1',
      userDisplayName: 'Ole Olsen',
      numbers: generateCouponNumbers(),
      markedCells: createEmptyMarkedGrid(),
      commitmentId: 'commitment-ole-2',
      isWinner: false,
      winCondition: null,
      purchasedAt: daysAgo(0),
    }
  );

  // Lisa: 2 coupons
  await setDoc(
    doc(db, 'locations', LOC_GNEIST, 'games', GAME_GNEIST_ACTIVE, 'coupons', 'coupon-lisa-1'),
    {
      userId: 'user-player-2',
      userDisplayName: 'Lisa Berg',
      numbers: generateCouponNumbers(),
      markedCells: createEmptyMarkedGrid(),
      commitmentId: 'commitment-lisa-2',
      isWinner: false,
      winCondition: null,
      purchasedAt: daysAgo(0),
    }
  );
  await setDoc(
    doc(db, 'locations', LOC_GNEIST, 'games', GAME_GNEIST_ACTIVE, 'coupons', 'coupon-lisa-2'),
    {
      userId: 'user-player-2',
      userDisplayName: 'Lisa Berg',
      numbers: generateCouponNumbers(),
      markedCells: createEmptyMarkedGrid(),
      commitmentId: 'commitment-lisa-3',
      isWinner: false,
      winCondition: null,
      purchasedAt: daysAgo(0),
    }
  );

  // Tarjei: 2 coupons
  await setDoc(
    doc(db, 'locations', LOC_GNEIST, 'games', GAME_GNEIST_ACTIVE, 'coupons', 'coupon-tarjei-1'),
    {
      userId: 'user-player-4',
      userDisplayName: 'Tarjei Vik',
      numbers: generateCouponNumbers(),
      markedCells: createEmptyMarkedGrid(),
      commitmentId: 'commitment-tarjei-2',
      isWinner: false,
      winCondition: null,
      purchasedAt: daysAgo(0),
    }
  );
  await setDoc(
    doc(db, 'locations', LOC_GNEIST, 'games', GAME_GNEIST_ACTIVE, 'coupons', 'coupon-tarjei-2'),
    {
      userId: 'user-player-4',
      userDisplayName: 'Tarjei Vik',
      numbers: generateCouponNumbers(),
      markedCells: createEmptyMarkedGrid(),
      commitmentId: 'commitment-tarjei-3',
      isWinner: false,
      winCondition: null,
      purchasedAt: daysAgo(0),
    }
  );

  // Mona: 1 coupon for Aurora
  await setDoc(
    doc(db, 'locations', LOC_AURORA, 'games', GAME_AURORA_ACTIVE, 'coupons', 'coupon-mona-1'),
    {
      userId: 'user-player-3',
      userDisplayName: 'Mona Lie',
      numbers: generateCouponNumbers(),
      markedCells: createEmptyMarkedGrid(),
      commitmentId: 'commitment-mona-1',
      isWinner: false,
      winCondition: null,
      purchasedAt: daysAgo(0),
    }
  );

  // Historical coupon for Ole in finished game
  await setDoc(
    doc(db, 'locations', LOC_GNEIST, 'games', GAME_GNEIST_FINISHED, 'coupons', 'coupon-ole-hist'),
    {
      userId: 'user-player-1',
      userDisplayName: 'Ole Olsen',
      numbers: generateCouponNumbers(),
      markedCells: createEmptyMarkedGrid(),
      commitmentId: 'commitment-ole-hist',
      isWinner: true,
      winCondition: 'row' as WinCondition,
      purchasedAt: daysAgo(7),
    }
  );
  log('8 kuponger opprettet');

  // 5. Create commitments
  log('Oppretter forpliktelser...');

  const commitmentData = [
    { id: 'commitment-ole-1', userId: 'user-player-1', userDisplayName: 'Ole Olsen', userPhone: '91234567', locationId: LOC_GNEIST, locationName: 'Idrettslaget Gneist', gameId: GAME_GNEIST_ACTIVE, couponId: 'coupon-ole-1', description: '1 time dugnad — loppemarked 5. april', status: 'pending', daysAgo: 0 },
    { id: 'commitment-ole-2', userId: 'user-player-1', userDisplayName: 'Ole Olsen', userPhone: '91234567', locationId: LOC_GNEIST, locationName: 'Idrettslaget Gneist', gameId: GAME_GNEIST_ACTIVE, couponId: 'coupon-ole-2', description: '1 time dugnad — loppemarked 5. april', status: 'pending', daysAgo: 0 },
    { id: 'commitment-lisa-1', userId: 'user-player-2', userDisplayName: 'Lisa Berg', userPhone: '92345678', locationId: LOC_GNEIST, locationName: 'Idrettslaget Gneist', gameId: GAME_GNEIST_FINISHED, couponId: 'coupon-lisa-hist', description: '1 time dugnad — julemarked', status: 'confirmed', daysAgo: 14 },
    { id: 'commitment-lisa-2', userId: 'user-player-2', userDisplayName: 'Lisa Berg', userPhone: '92345678', locationId: LOC_GNEIST, locationName: 'Idrettslaget Gneist', gameId: GAME_GNEIST_ACTIVE, couponId: 'coupon-lisa-1', description: '1 time dugnad — loppemarked 5. april', status: 'pending', daysAgo: 0 },
    { id: 'commitment-tarjei-1', userId: 'user-player-4', userDisplayName: 'Tarjei Vik', userPhone: '94567890', locationId: LOC_GNEIST, locationName: 'Idrettslaget Gneist', gameId: GAME_GNEIST_FINISHED, couponId: 'coupon-tarjei-hist', description: 'Vaske garderober — frist 1. mars', status: 'overdue', daysAgo: 18 },
    { id: 'commitment-tarjei-2', userId: 'user-player-4', userDisplayName: 'Tarjei Vik', userPhone: '94567890', locationId: LOC_GNEIST, locationName: 'Idrettslaget Gneist', gameId: GAME_GNEIST_ACTIVE, couponId: 'coupon-tarjei-1', description: '1 time dugnad — loppemarked 5. april', status: 'pending', daysAgo: 0 },
    { id: 'commitment-mona-1', userId: 'user-player-3', userDisplayName: 'Mona Lie', userPhone: '93456789', locationId: LOC_AURORA, locationName: 'Kulturhuset Aurora', gameId: GAME_AURORA_ACTIVE, couponId: 'coupon-mona-1', description: 'Bake kake til neste arrangement', status: 'pending', daysAgo: 0 },
  ];

  for (const c of commitmentData) {
    await setDoc(doc(db, 'commitments', c.id), {
      userId: c.userId,
      userDisplayName: c.userDisplayName,
      userPhone: c.userPhone,
      locationId: c.locationId,
      locationName: c.locationName,
      gameId: c.gameId,
      couponId: c.couponId,
      description: c.description,
      status: c.status,
      dueDate: c.status === 'overdue' ? daysAgo(18) : null,
      confirmedAt: c.status === 'confirmed' ? daysAgo(10) : null,
      confirmedBy: c.status === 'confirmed' ? 'user-admin-gneist' : null,
      createdAt: daysAgo(c.daysAgo),
    });
  }
  log(`${commitmentData.length} forpliktelser opprettet`);

  // 6. Create pending bingo claim
  log('Oppretter bingo-krav...');
  await setDoc(
    doc(db, 'locations', LOC_GNEIST, 'games', GAME_GNEIST_ACTIVE, 'bingo_claims', 'claim-tarjei-1'),
    {
      userId: 'user-player-4',
      userDisplayName: 'Tarjei Vik',
      couponId: 'coupon-tarjei-1',
      status: 'pending',
      suggestedWinCondition: 'row' as WinCondition,
      approvedWinCondition: null,
      reviewedBy: null,
      reviewedAt: null,
      claimedAt: serverTimestamp(),
    }
  );
  log('1 bingo-krav opprettet');

  log('Seed komplett!');
}

// ─── Simulate drawing ────────────────────────────────────

export async function simulateDrawing(
  locationId: string,
  gameId: string,
  count: number,
  onProgress?: (msg: string) => void
): Promise<void> {
  const log = onProgress ?? console.log;
  const { getDoc } = await import('firebase/firestore');
  const gameDocRef = doc(db, 'locations', locationId, 'games', gameId);
  const snap = await getDoc(gameDocRef);

  if (!snap.exists()) {
    throw new Error('Spill finnes ikke');
  }

  const data = snap.data();
  const drawn: number[] = data.drawnNumbers ?? [];
  const drawnSet = new Set(drawn);

  // Build remaining numbers
  const remaining: number[] = [];
  for (let i = 1; i <= 75; i++) {
    if (!drawnSet.has(i)) remaining.push(i);
  }

  // Shuffle
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j]!, remaining[i]!];
  }

  const toDraw = remaining.slice(0, Math.min(count, remaining.length));

  for (const num of toDraw) {
    await updateDoc(gameDocRef, {
      drawnNumbers: arrayUnion(num),
      currentNumber: num,
      lastDrawAt: serverTimestamp(),
    });
    log(`Trukket: ${num}`);
  }

  log(`${toDraw.length} tall trukket`);
}

// ─── Simulate bingo claim ────────────────────────────────

export async function simulateBingoClaim(
  locationId: string,
  gameId: string,
  userId: string,
  userDisplayName: string,
  couponId: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  const log = onProgress ?? console.log;
  const { addDoc } = await import('firebase/firestore');

  await addDoc(
    collection(db, 'locations', locationId, 'games', gameId, 'bingo_claims'),
    {
      userId,
      userDisplayName,
      couponId,
      status: 'pending',
      suggestedWinCondition: 'row' as WinCondition,
      approvedWinCondition: null,
      reviewedBy: null,
      reviewedAt: null,
      claimedAt: serverTimestamp(),
    }
  );
  log(`Bingo-rop sendt fra ${userDisplayName}`);
}

// ─── Get collection counts ───────────────────────────────

export interface CollectionCounts {
  users: number;
  locations: number;
  commitments: number;
  games: Record<string, number>;
  coupons: Record<string, number>;
  claims: Record<string, number>;
}

export async function getCollectionCounts(): Promise<CollectionCounts> {
  const usersSnap = await getDocs(collection(db, 'users'));
  const locSnap = await getDocs(collection(db, 'locations'));
  const commSnap = await getDocs(collection(db, 'commitments'));

  const games: Record<string, number> = {};
  const coupons: Record<string, number> = {};
  const claims: Record<string, number> = {};

  for (const locDoc of locSnap.docs) {
    const gamesSnap = await getDocs(collection(db, 'locations', locDoc.id, 'games'));
    games[locDoc.id] = gamesSnap.size;

    for (const gameDoc of gamesSnap.docs) {
      const key = `${locDoc.id}/${gameDoc.id}`;
      const couponSnap = await getDocs(
        collection(db, 'locations', locDoc.id, 'games', gameDoc.id, 'coupons')
      );
      coupons[key] = couponSnap.size;

      const claimSnap = await getDocs(
        collection(db, 'locations', locDoc.id, 'games', gameDoc.id, 'bingo_claims')
      );
      claims[key] = claimSnap.size;
    }
  }

  return {
    users: usersSnap.size,
    locations: locSnap.size,
    commitments: commSnap.size,
    games,
    coupons,
    claims,
  };
}

// ─── Exported constants for UI ───────────────────────────

export const SEED_LOCATIONS = [
  { id: LOC_GNEIST, name: 'Idrettslaget Gneist' },
  { id: LOC_AURORA, name: 'Kulturhuset Aurora' },
  { id: LOC_FRISK, name: 'Sportsklubben Frisk' },
];

export const SEED_GAMES: Record<string, Array<{ id: string; name: string }>> = {
  [LOC_GNEIST]: [
    { id: GAME_GNEIST_ACTIVE, name: 'Aktivt spill (pagaende trekning)' },
    { id: GAME_GNEIST_FINISHED, name: 'Historisk spill (avsluttet)' },
  ],
  [LOC_AURORA]: [
    { id: GAME_AURORA_ACTIVE, name: 'Aktivt spill (apent for kjop)' },
  ],
  [LOC_FRISK]: [],
};

export const SEED_PLAYERS = TEST_USERS.filter((u) => u.role === 'player').map((u) => ({
  uid: u.uid,
  displayName: u.displayName,
}));
