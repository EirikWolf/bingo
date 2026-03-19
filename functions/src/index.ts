import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import {
  onDocumentCreated,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { findWinCondition } from './bingoValidator';

initializeApp();
const db = getFirestore();

// ─── Server-side bingo claim validation ──────────────────

/**
 * When a bingo claim is created, validate it server-side.
 * Sets serverValidated: true and serverValidatedCondition on the claim.
 */
export const onBingoClaimCreated = onDocumentCreated(
  'locations/{locationId}/games/{gameId}/bingo_claims/{claimId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const claim = snap.data();
    const { locationId, gameId } = event.params;

    try {
      // Read the coupon
      const couponSnap = await db
        .doc(`locations/${locationId}/games/${gameId}/coupons/${claim.couponId}`)
        .get();

      if (!couponSnap.exists) {
        logger.warn('Claim references non-existent coupon', { claimId: event.params.claimId });
        await snap.ref.update({
          serverValidated: true,
          serverValidatedCondition: null,
        });
        return;
      }

      // Read the game
      const gameSnap = await db.doc(`locations/${locationId}/games/${gameId}`).get();
      if (!gameSnap.exists) {
        await snap.ref.update({
          serverValidated: true,
          serverValidatedCondition: null,
        });
        return;
      }

      const coupon = couponSnap.data()!;
      const game = gameSnap.data()!;

      // Validate the claim
      const drawnSet = new Set<number>(game.drawnNumbers ?? []);
      const winCondition = findWinCondition(
        coupon.numbers,
        drawnSet,
        game.winConditions ?? []
      );

      await snap.ref.update({
        serverValidated: true,
        serverValidatedCondition: winCondition,
      });

      logger.info('Claim validated', {
        claimId: event.params.claimId,
        valid: winCondition !== null,
        condition: winCondition,
      });
    } catch (error) {
      logger.error('Error validating claim', error);
      await snap.ref.update({
        serverValidated: true,
        serverValidatedCondition: null,
      });
    }
  }
);

// ─── Push notifications ──────────────────────────────────

/**
 * Helper: Get all FCM tokens for users at a specific location.
 */
async function getTokensForLocation(locationId: string): Promise<string[]> {
  const tokensSnap = await db
    .collectionGroup('fcmTokens')
    .where('locationId', '==', locationId)
    .get();

  return tokensSnap.docs.map((d) => d.data().token as string);
}

/**
 * Helper: Send FCM to multiple tokens, cleaning up stale ones.
 */
async function sendToTokens(
  tokens: string[],
  title: string,
  body: string,
  link?: string
): Promise<void> {
  if (tokens.length === 0) return;

  const messaging = getMessaging();

  // FCM supports max 500 tokens per multicast
  const BATCH_SIZE = 500;
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);

    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      webpush: {
        fcmOptions: { link: link ?? '/' },
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
        },
      },
    });

    // Clean up stale tokens
    if (response.failureCount > 0) {
      const staleTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (resp.error?.code === 'messaging/registration-token-not-registered' ||
            resp.error?.code === 'messaging/invalid-registration-token') {
          staleTokens.push(batch[idx]!);
        }
      });

      // Delete stale tokens from Firestore
      if (staleTokens.length > 0) {
        const staleSet = new Set(staleTokens);
        const allTokenDocs = await db.collectionGroup('fcmTokens')
          .where('token', 'in', [...staleSet])
          .get();
        const deleteBatch = db.batch();
        allTokenDocs.docs.forEach((d) => deleteBatch.delete(d.ref));
        await deleteBatch.commit();
        logger.info(`Cleaned up ${staleTokens.length} stale FCM tokens`);
      }
    }

    logger.info(`Sent ${response.successCount}/${batch.length} notifications`);
  }
}

/**
 * When game status changes to 'open', notify all users at the location.
 */
export const onGameStatusChanged = onDocumentUpdated(
  'locations/{locationId}/games/{gameId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const { locationId } = event.params;

    // Game opened for purchase
    if (before.status !== 'open' && after.status === 'open') {
      const locationSnap = await db.doc(`locations/${locationId}`).get();
      const locationName = locationSnap.data()?.name ?? 'Bingo';

      const tokens = await getTokensForLocation(locationId);
      await sendToTokens(
        tokens,
        `${locationName}`,
        'Spillet er nå åpent for kupongkjøp!',
        `/spill/${locationId}`
      );
    }

    // Game started (active)
    if (before.status !== 'active' && after.status === 'active') {
      const locationSnap = await db.doc(`locations/${locationId}`).get();
      const locationName = locationSnap.data()?.name ?? 'Bingo';

      const tokens = await getTokensForLocation(locationId);
      await sendToTokens(
        tokens,
        `${locationName}`,
        'Trekningen har startet!',
        `/spill/${locationId}`
      );
    }

    // Winner announced (winners array grew)
    if ((before.winners?.length ?? 0) < (after.winners?.length ?? 0)) {
      const newWinners = after.winners.slice(before.winners?.length ?? 0);
      const winnerNames = newWinners.map((w: { displayName: string }) => w.displayName).join(', ');

      const locationSnap = await db.doc(`locations/${locationId}`).get();
      const locationName = locationSnap.data()?.name ?? 'Bingo';

      const tokens = await getTokensForLocation(locationId);
      await sendToTokens(
        tokens,
        'BINGO!',
        `${winnerNames} har vunnet hos ${locationName}!`,
        `/spill/${locationId}`
      );
    }
  }
);

/**
 * When a bingo claim is created, notify admins.
 */
export const onBingoClaimNotify = onDocumentCreated(
  'locations/{locationId}/games/{gameId}/bingo_claims/{claimId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const claim = snap.data();
    const { locationId } = event.params;

    // Get admin UIDs for this location
    const locationSnap = await db.doc(`locations/${locationId}`).get();
    const adminUids: string[] = locationSnap.data()?.adminUids ?? [];
    const locationName = locationSnap.data()?.name ?? 'Bingo';

    // Get admin FCM tokens
    const tokens: string[] = [];
    for (const uid of adminUids) {
      const tokenSnap = await db.collection(`users/${uid}/fcmTokens`).get();
      tokenSnap.docs.forEach((d) => tokens.push(d.data().token));
    }

    await sendToTokens(
      tokens,
      'Bingo-rop!',
      `${claim.userDisplayName} påstår bingo hos ${locationName}!`,
      `/admin/${locationId}`
    );
  }
);

// ─── Vipps payment confirmation (admin-triggered) ────────

/**
 * When a coupon's paymentStatus changes to 'paid', confirm the commitment.
 */
export const onPaymentConfirmed = onDocumentUpdated(
  'locations/{locationId}/games/{gameId}/coupons/{couponId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger when paymentStatus changes to 'paid'
    if (before.paymentStatus === after.paymentStatus) return;
    if (after.paymentStatus !== 'paid') return;

    // Update the linked commitment status
    if (after.commitmentId) {
      try {
        await db.doc(`commitments/${after.commitmentId}`).update({
          status: 'confirmed',
          confirmedAt: FieldValue.serverTimestamp(),
          confirmedBy: 'system-vipps',
        });
        logger.info('Auto-confirmed commitment after Vipps payment', {
          commitmentId: after.commitmentId,
        });
      } catch (error) {
        logger.error('Failed to auto-confirm commitment', error);
      }
    }
  }
);

// ─── #13: Automatic winner approval ─────────────────────
// When server-side validation confirms a bingo claim is valid,
// automatically approve it without admin intervention.

export const onClaimServerValidated = onDocumentUpdated(
  'locations/{locationId}/games/{gameId}/bingo_claims/{claimId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger when serverValidated changes to true
    if (before.serverValidated || !after.serverValidated) return;

    // Only auto-approve if validation found a win condition and claim is still pending
    if (!after.serverValidatedCondition || after.status !== 'pending') return;

    const { locationId, gameId, claimId } = event.params;

    try {
      const batch = db.batch();

      // Approve the claim
      batch.update(event.data!.after.ref, {
        status: 'approved',
        approvedWinCondition: after.serverValidatedCondition,
        reviewedBy: 'system-auto',
        reviewedAt: FieldValue.serverTimestamp(),
      });

      // Mark coupon as winner
      const couponRef = db.doc(
        `locations/${locationId}/games/${gameId}/coupons/${after.couponId}`
      );
      batch.update(couponRef, {
        isWinner: true,
        winCondition: after.serverValidatedCondition,
      });

      // Add winner to game
      const gameRef = db.doc(`locations/${locationId}/games/${gameId}`);
      batch.update(gameRef, {
        winners: FieldValue.arrayUnion({
          userId: after.userId,
          displayName: after.userDisplayName,
          couponId: after.couponId,
          winCondition: after.serverValidatedCondition,
        }),
      });

      await batch.commit();

      logger.info('Auto-approved valid bingo claim', {
        claimId,
        userId: after.userId,
        condition: after.serverValidatedCondition,
      });
    } catch (error) {
      logger.error('Failed to auto-approve claim', { claimId, error });
    }
  }
);

// ─── #11: Server-side auto-draw ──────────────────────────
// Runs every minute, checks active games with autoDrawActive=true,
// and draws the next number if enough time has elapsed.

export const autoDrawScheduler = onSchedule(
  { schedule: 'every 1 minutes', timeoutSeconds: 60 },
  async () => {
    // Find all locations with active games
    const locationsSnap = await db.collection('locations')
      .where('activeGameId', '!=', null)
      .get();

    if (locationsSnap.empty) return;

    let drawCount = 0;

    for (const locDoc of locationsSnap.docs) {
      const loc = locDoc.data();
      if (!loc.activeGameId) continue;

      const gameRef = db.doc(`locations/${locDoc.id}/games/${loc.activeGameId}`);
      const gameSnap = await gameRef.get();
      if (!gameSnap.exists) continue;

      const game = gameSnap.data()!;

      // Only process active games with auto-draw enabled
      if (game.status !== 'active' || !game.autoDrawActive) continue;

      // Check if enough time has elapsed since last draw
      const intervalMs = game.autoDrawIntervalMs ?? 5000;
      const lastDraw = game.lastDrawAt as Timestamp | null;
      const now = Date.now();

      if (lastDraw) {
        const elapsed = now - lastDraw.toMillis();
        if (elapsed < intervalMs) continue;
      }

      // Pick a random undrawn number
      const drawn = new Set<number>(game.drawnNumbers ?? []);
      const totalNumbers = game.totalNumbers ?? 75;

      if (drawn.size >= totalNumbers) {
        // All numbers drawn — stop auto-draw
        await gameRef.update({ autoDrawActive: false });
        continue;
      }

      const available: number[] = [];
      for (let n = 1; n <= totalNumbers; n++) {
        if (!drawn.has(n)) available.push(n);
      }

      const nextNumber = available[Math.floor(Math.random() * available.length)]!;

      await gameRef.update({
        drawnNumbers: FieldValue.arrayUnion(nextNumber),
        currentNumber: nextNumber,
        lastDrawAt: FieldValue.serverTimestamp(),
      });

      drawCount++;
      logger.info('Auto-drew number', {
        locationId: locDoc.id,
        gameId: loc.activeGameId,
        number: nextNumber,
        totalDrawn: drawn.size + 1,
      });
    }

    if (drawCount > 0) {
      logger.info(`Auto-draw scheduler: drew ${drawCount} numbers`);
    }
  }
);

// ─── #3: Automatic cleanup ──────────────────────────────
// Runs daily at 03:00. Cleans up stale FCM tokens, marks overdue
// commitments, and finishes abandoned games.

export const dailyCleanup = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'Europe/Oslo', timeoutSeconds: 120 },
  async () => {
    const now = Timestamp.now();
    const thirtyDaysAgo = Timestamp.fromMillis(now.toMillis() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = Timestamp.fromMillis(now.toMillis() - 7 * 24 * 60 * 60 * 1000);

    // 1. Mark overdue commitments (pending for >30 days)
    let overdueCount = 0;
    const pendingCommitments = await db.collection('commitments')
      .where('status', '==', 'pending')
      .where('createdAt', '<', thirtyDaysAgo)
      .limit(500)
      .get();

    if (!pendingCommitments.empty) {
      const batch = db.batch();
      pendingCommitments.docs.forEach((doc) => {
        batch.update(doc.ref, { status: 'overdue' });
      });
      await batch.commit();
      overdueCount = pendingCommitments.size;
    }

    // 2. Clean up stale FCM tokens (older than 30 days with no refresh)
    let staleTokenCount = 0;
    const staleTokens = await db.collectionGroup('fcmTokens')
      .where('createdAt', '<', thirtyDaysAgo)
      .limit(500)
      .get();

    if (!staleTokens.empty) {
      const batch = db.batch();
      staleTokens.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      staleTokenCount = staleTokens.size;
    }

    // 3. Finish abandoned games (active/paused for >7 days)
    let abandonedCount = 0;
    const locations = await db.collection('locations')
      .where('activeGameId', '!=', null)
      .get();

    for (const locDoc of locations.docs) {
      const loc = locDoc.data();
      if (!loc.activeGameId) continue;

      const gameRef = db.doc(`locations/${locDoc.id}/games/${loc.activeGameId}`);
      const gameSnap = await gameRef.get();
      if (!gameSnap.exists) continue;

      const game = gameSnap.data()!;
      const startedAt = game.startedAt as Timestamp | null;
      const createdAt = game.createdAt as Timestamp | null;
      const gameAge = startedAt ?? createdAt;

      if (
        (game.status === 'active' || game.status === 'paused' || game.status === 'open' || game.status === 'setup') &&
        gameAge && gameAge.toMillis() < sevenDaysAgo.toMillis()
      ) {
        const batch = db.batch();
        batch.update(gameRef, {
          status: 'finished',
          finishedAt: FieldValue.serverTimestamp(),
          autoDrawActive: false,
        });
        batch.update(locDoc.ref, {
          activeGameId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        await batch.commit();
        abandonedCount++;

        logger.info('Finished abandoned game', {
          locationId: locDoc.id,
          gameId: loc.activeGameId,
          previousStatus: game.status,
        });
      }
    }

    logger.info('Daily cleanup complete', {
      overdueCommitments: overdueCount,
      staleTokensRemoved: staleTokenCount,
      abandonedGamesFinished: abandonedCount,
    });
  }
);
