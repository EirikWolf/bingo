import {
  doc,
  writeBatch,
  updateDoc,
  addDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  increment,
  collection,
} from 'firebase/firestore';
import { db } from './firebase';
import { locationRef, gameRef, userRef } from './firestore';
import { generateCouponNumbers, createEmptyMarkedGrid } from '@/utils/couponGenerator';
import { VALID_STATUS_TRANSITIONS } from '@/utils/constants';
import type { GameStatus, WinCondition, PaymentMethod, PaymentStatus } from '@/types';

// ─── User profile ─────────────────────────────────────────

export async function updateUserProfile(
  userId: string,
  data: { displayName?: string; phone?: string | null }
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (data.displayName !== undefined) updates.displayName = data.displayName;
  if (data.phone !== undefined) updates.phone = data.phone ?? null;
  if (Object.keys(updates).length === 0) return;
  await updateDoc(userRef(userId), updates);
}

// ─── Coupon purchase ─────────────────────────────────────

export async function purchaseCoupon(
  locationId: string,
  gameId: string,
  userId: string,
  userDisplayName: string,
  userPhone: string | null,
  locationName: string,
  commitmentDescription: string,
  paymentMethod: PaymentMethod = 'commitment',
  paymentStatus: PaymentStatus = 'pending'
): Promise<string> {
  const batch = writeBatch(db);

  // Generate coupon
  const numbers = generateCouponNumbers();
  const markedCells = createEmptyMarkedGrid();

  // Pre-generate document refs so IDs are known before commit
  const couponRef = doc(collection(db, 'locations', locationId, 'games', gameId, 'coupons'));
  const commitmentRef = doc(collection(db, 'commitments'));

  // Create coupon document with commitment ID set directly
  batch.set(couponRef, {
    userId,
    userDisplayName,
    numbers,
    markedCells,
    commitmentId: commitmentRef.id,
    isWinner: false,
    winCondition: null,
    paymentMethod,
    paymentStatus,
    purchasedAt: serverTimestamp(),
  });

  // Create commitment document
  batch.set(commitmentRef, {
    userId,
    userDisplayName,
    userPhone: userPhone ?? null,
    locationId,
    locationName,
    gameId,
    couponId: couponRef.id,
    description: commitmentDescription,
    status: 'pending',
    dueDate: null,
    confirmedAt: null,
    confirmedBy: null,
    createdAt: serverTimestamp(),
  });

  // Increment game coupon count
  batch.update(gameRef(locationId, gameId), {
    couponCount: increment(1),
  });

  await batch.commit();
  return couponRef.id;
}

export async function confirmCouponPayment(
  locationId: string,
  gameId: string,
  couponId: string,
  commitmentId: string
): Promise<void> {
  const batch = writeBatch(db);

  batch.update(
    doc(db, 'locations', locationId, 'games', gameId, 'coupons', couponId),
    { paymentStatus: 'paid' as PaymentStatus }
  );

  // Also confirm the linked commitment
  batch.update(
    doc(db, 'commitments', commitmentId),
    {
      status: 'confirmed',
      confirmedAt: serverTimestamp(),
      confirmedBy: 'vipps-auto',
    }
  );

  await batch.commit();
}

// ─── Game management (admin) ─────────────────────────────

export async function createGame(
  locationId: string,
  commitment: string,
  winConditions: WinCondition[]
): Promise<string> {
  const batch = writeBatch(db);

  const gameDocRef = doc(collection(db, 'locations', locationId, 'games'));
  batch.set(gameDocRef, {
    status: 'setup' as GameStatus,
    drawnNumbers: [],
    currentNumber: null,
    totalNumbers: 75,
    winConditions,
    winners: [],
    couponCount: 0,
    playerCount: 0,
    commitment,
    autoDrawActive: false,
    autoDrawIntervalMs: 5000,
    lastDrawAt: null,
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
  newStatus: GameStatus,
  currentStatus?: GameStatus
): Promise<void> {
  // Validate status transition if current status is provided
  if (currentStatus) {
    const valid = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!valid.includes(newStatus)) {
      throw new Error(`Ugyldig statusovergang: ${currentStatus} → ${newStatus}`);
    }
  }

  const updates: Record<string, unknown> = {
    status: newStatus,
  };

  if (newStatus === 'active') {
    updates.startedAt = serverTimestamp();
  }

  if (newStatus === 'finished') {
    updates.finishedAt = serverTimestamp();
    // Use batch to atomically update both game and location
    const batch = writeBatch(db);
    batch.update(gameRef(locationId, gameId), updates);
    batch.update(locationRef(locationId), {
      activeGameId: null,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return;
  }

  await updateDoc(gameRef(locationId, gameId), updates);
}

export async function drawNumber(
  locationId: string,
  gameId: string,
  number: number
): Promise<void> {
  await updateDoc(gameRef(locationId, gameId), {
    drawnNumbers: arrayUnion(number),
    currentNumber: number,
    lastDrawAt: serverTimestamp(),
  });
}

export async function updateAutoDrawState(
  locationId: string,
  gameId: string,
  active: boolean,
  intervalMs: number
): Promise<void> {
  await updateDoc(gameRef(locationId, gameId), {
    autoDrawActive: active,
    autoDrawIntervalMs: intervalMs,
  });
}

// ─── Bingo claims ────────────────────────────────────────

export async function submitBingoClaim(
  locationId: string,
  gameId: string,
  userId: string,
  userDisplayName: string,
  couponId: string,
  suggestedWinCondition: WinCondition | null
): Promise<string> {
  const claimRef = await addDoc(
    collection(db, 'locations', locationId, 'games', gameId, 'bingo_claims'),
    {
      userId,
      userDisplayName,
      couponId,
      status: 'pending',
      suggestedWinCondition,
      approvedWinCondition: null,
      serverValidated: false,
      serverValidatedCondition: null,
      reviewedBy: null,
      reviewedAt: null,
      claimedAt: serverTimestamp(),
    }
  );
  return claimRef.id;
}

export async function approveBingoClaim(
  locationId: string,
  gameId: string,
  claimId: string,
  couponId: string,
  winCondition: WinCondition,
  winnerId: string,
  winnerName: string,
  reviewerId: string
): Promise<void> {
  const batch = writeBatch(db);

  // Update claim
  batch.update(
    doc(db, 'locations', locationId, 'games', gameId, 'bingo_claims', claimId),
    {
      status: 'approved',
      approvedWinCondition: winCondition,
      reviewedBy: reviewerId,
      reviewedAt: serverTimestamp(),
    }
  );

  // Mark coupon as winner
  batch.update(
    doc(db, 'locations', locationId, 'games', gameId, 'coupons', couponId),
    {
      isWinner: true,
      winCondition,
    }
  );

  // Add winner to game
  batch.update(gameRef(locationId, gameId), {
    winners: arrayUnion({
      userId: winnerId,
      displayName: winnerName,
      couponId,
      winCondition,
    }),
  });

  await batch.commit();
}

export async function rejectBingoClaim(
  locationId: string,
  gameId: string,
  claimId: string,
  reviewerId: string
): Promise<void> {
  await updateDoc(
    doc(db, 'locations', locationId, 'games', gameId, 'bingo_claims', claimId),
    {
      status: 'rejected',
      reviewedBy: reviewerId,
      reviewedAt: serverTimestamp(),
    }
  );
}

// ─── Commitment management (admin) ───────────────────────

export async function updateCommitmentStatus(
  commitmentId: string,
  status: 'confirmed' | 'cancelled',
  reviewerId: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
  };
  if (status === 'confirmed') {
    updates.confirmedAt = serverTimestamp();
    updates.confirmedBy = reviewerId;
  }
  await updateDoc(doc(db, 'commitments', commitmentId), updates);
}

export async function batchConfirmCommitments(
  commitmentIds: string[],
  reviewerId: string
): Promise<void> {
  // Firestore batches have a max of 500 operations — chunk if needed
  const BATCH_LIMIT = 500;
  for (let i = 0; i < commitmentIds.length; i += BATCH_LIMIT) {
    const chunk = commitmentIds.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.update(doc(db, 'commitments', id), {
        status: 'confirmed',
        confirmedAt: serverTimestamp(),
        confirmedBy: reviewerId,
      });
    }
    await batch.commit();
  }
}

// ─── Location management (superadmin) ────────────────────

export async function createLocation(
  name: string,
  description: string,
  adminUids: string[]
): Promise<string> {
  const locRef = doc(collection(db, 'locations'));
  await setDoc(locRef, {
    name,
    description,
    imageURL: null,
    pinCode: null,
    adminUids,
    activeGameId: null,
    settings: {
      maxCouponsPerPlayer: 0,
      defaultCommitment: '1 time dugnad per kupong',
      commitmentLevels: [],
      allowAnonymous: false,
      autoDrawEnabled: false,
      autoDrawIntervalMs: 5000,
      winConditions: ['row', 'column', 'diagonal'],
      vippsNumber: null,
      vippsDefaultAmount: null,
      couponPricing: null,
      reminderEnabled: false,
      speech: {
        enabled: true,
        voiceURI: null,
        rate: 0.9,
        volume: 1.0,
      },
    },
    playerCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return locRef.id;
}

export async function updateLocationSettings(
  locationId: string,
  settings: Record<string, unknown>
): Promise<void> {
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [key, value] of Object.entries(settings)) {
    updates[`settings.${key}`] = value;
  }
  await updateDoc(locationRef(locationId), updates);
}

// ─── Admin management ──────────────────────────────────────

export async function addLocationAdmin(
  locationId: string,
  uid: string
): Promise<void> {
  await updateDoc(locationRef(locationId), {
    adminUids: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function removeLocationAdmin(
  locationId: string,
  uid: string,
  creatorUid: string
): Promise<void> {
  if (uid === creatorUid) {
    throw new Error('Kan ikke fjerne oppretter av lokasjonen');
  }
  await updateDoc(locationRef(locationId), {
    adminUids: arrayRemove(uid),
    updatedAt: serverTimestamp(),
  });
}
