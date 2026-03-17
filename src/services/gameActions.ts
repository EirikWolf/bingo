import {
  doc,
  setDoc,
  updateDoc,
  addDoc,
  arrayUnion,
  serverTimestamp,
  increment,
  writeBatch,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  gamesRef,
  gameRef,
  couponsRef,
  bingoClaimsRef,
  bingoClaimRef,
  couponRef,
  commitmentsRef,
  locationRef,
} from './firestore';
import { generateCouponNumbers, createEmptyMarkedGrid } from '@/utils/couponGenerator';
import { checkWinConditions } from '@/utils/bingoValidator';
import { markDrawnNumbers } from '@/utils/couponGenerator';
import type { WinCondition, GameStatus, Game } from '@/types';

// ============================================================
// Kupongkjøp (erstatter purchaseCoupon Cloud Function)
// ============================================================

interface PurchaseResult {
  couponId: string;
  commitmentId: string;
}

export async function purchaseCoupon(
  locationId: string,
  gameId: string,
  userId: string,
  userDisplayName: string,
  commitmentDescription: string,
  locationName: string
): Promise<PurchaseResult> {
  const batch = writeBatch(db);

  // Generer kupong på klienten
  const numbers = generateCouponNumbers();
  const markedCells = createEmptyMarkedGrid();

  const couponDocRef = doc(couponsRef(locationId, gameId));
  const commitmentDocRef = doc(commitmentsRef());

  // Opprett kupong
  batch.set(couponDocRef, {
    userId,
    userDisplayName,
    numbers,
    markedCells,
    commitmentId: commitmentDocRef.id,
    isWinner: false,
    winCondition: null,
    purchasedAt: serverTimestamp(),
  });

  // Opprett forpliktelse
  batch.set(commitmentDocRef, {
    userId,
    userDisplayName,
    locationId,
    locationName,
    gameId,
    couponId: couponDocRef.id,
    description: commitmentDescription,
    status: 'pending',
    dueDate: null,
    confirmedAt: null,
    confirmedBy: null,
    createdAt: serverTimestamp(),
  });

  // Oppdater tellere på spillet
  batch.update(gameRef(locationId, gameId), {
    couponCount: increment(1),
  });

  await batch.commit();

  return {
    couponId: couponDocRef.id,
    commitmentId: commitmentDocRef.id,
  };
}

// ============================================================
// Bingo-rop (erstatter claimBingo Cloud Function)
// Spilleren sender et claim, bingovert godkjenner manuelt
// ============================================================

export async function submitBingoClaim(
  locationId: string,
  gameId: string,
  couponId: string,
  userId: string,
  userDisplayName: string,
  suggestedWinCondition: WinCondition | null
): Promise<string> {
  const claimRef = await addDoc(bingoClaimsRef(locationId, gameId), {
    userId,
    userDisplayName,
    couponId,
    status: 'pending',
    suggestedWinCondition,
    approvedWinCondition: null,
    reviewedBy: null,
    reviewedAt: null,
    claimedAt: serverTimestamp(),
  });

  return claimRef.id;
}

/**
 * Admin godkjenner et Bingo-rop.
 * Oppdaterer claim, kupongen og spillets vinnerarray.
 */
export async function approveBingoClaim(
  locationId: string,
  gameId: string,
  claimId: string,
  couponId: string,
  winCondition: WinCondition,
  adminUid: string,
  winnerUserId: string,
  winnerDisplayName: string
): Promise<void> {
  const batch = writeBatch(db);

  // Oppdater claim-status
  batch.update(bingoClaimRef(locationId, gameId, claimId), {
    status: 'approved',
    approvedWinCondition: winCondition,
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp(),
  });

  // Marker kupong som vinner
  batch.update(couponRef(locationId, gameId, couponId), {
    isWinner: true,
    winCondition,
  });

  // Legg til i spillets vinnerarray
  batch.update(gameRef(locationId, gameId), {
    winners: arrayUnion({
      userId: winnerUserId,
      displayName: winnerDisplayName,
      couponId,
      winCondition,
      claimedAt: new Date().toISOString(),
    }),
  });

  await batch.commit();
}

/** Admin avviser et Bingo-rop. */
export async function rejectBingoClaim(
  locationId: string,
  gameId: string,
  claimId: string,
  adminUid: string
): Promise<void> {
  await updateDoc(bingoClaimRef(locationId, gameId, claimId), {
    status: 'rejected',
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp(),
  });
}

// ============================================================
// Spillstyring (erstatter admin Cloud Functions)
// ============================================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  setup: ['open'],
  open: ['active'],
  active: ['paused', 'finished'],
  paused: ['active', 'finished'],
};

export async function createGame(
  locationId: string,
  commitment: string,
  winConditions: WinCondition[]
): Promise<string> {
  const gameDocRef = doc(gamesRef(locationId));

  const batch = writeBatch(db);

  batch.set(gameDocRef, {
    status: 'setup' as GameStatus,
    drawnNumbers: [],
    currentNumber: null,
    totalNumbers: 75,
    winConditions: winConditions.length > 0 ? winConditions : ['row', 'column', 'diagonal'],
    winners: [],
    couponCount: 0,
    playerCount: 0,
    commitment,
    createdAt: serverTimestamp(),
    startedAt: null,
    finishedAt: null,
  });

  batch.update(locationRef(locationId), {
    activeGameId: gameDocRef.id,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return gameDocRef.id;
}

export async function updateGameStatus(
  locationId: string,
  gameId: string,
  newStatus: GameStatus
): Promise<void> {
  const gameSnap = await getDoc(gameRef(locationId, gameId));
  if (!gameSnap.exists()) throw new Error('Spillet finnes ikke.');

  const currentStatus = gameSnap.data().status as string;
  const allowed = VALID_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Kan ikke endre status fra "${currentStatus}" til "${newStatus}". Tillatt: ${allowed.join(', ') || 'ingen'}.`
    );
  }

  const updates: Record<string, unknown> = { status: newStatus };

  if (newStatus === 'active' && !gameSnap.data().startedAt) {
    updates.startedAt = serverTimestamp();
  }

  if (newStatus === 'finished') {
    updates.finishedAt = serverTimestamp();
    await updateDoc(locationRef(locationId), {
      activeGameId: null,
      updatedAt: serverTimestamp(),
    });
  }

  await updateDoc(gameRef(locationId, gameId), updates);
}

// ============================================================
// Trekning (erstatter drawNumber Cloud Function)
// ============================================================

export async function drawNumber(
  locationId: string,
  gameId: string,
  game: Game
): Promise<number> {
  const drawnSet = new Set(game.drawnNumbers);
  const available: number[] = [];
  for (let i = 1; i <= (game.totalNumbers || 75); i++) {
    if (!drawnSet.has(i)) available.push(i);
  }

  if (available.length === 0) {
    throw new Error('Alle tall er allerede trukket.');
  }

  const randomIndex = Math.floor(Math.random() * available.length);
  const newNumber = available[randomIndex];

  await updateDoc(gameRef(locationId, gameId), {
    drawnNumbers: arrayUnion(newNumber),
    currentNumber: newNumber,
  });

  return newNumber;
}

// ============================================================
// Forpliktelseshåndtering
// ============================================================

export async function updateCommitmentStatus(
  commitmentId: string,
  status: 'confirmed' | 'cancelled',
  adminUid: string
): Promise<void> {
  await updateDoc(doc(commitmentsRef(), commitmentId), {
    status,
    confirmedAt: status === 'confirmed' ? serverTimestamp() : null,
    confirmedBy: adminUid,
  });
}
