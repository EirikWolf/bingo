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

// ─── CF-012: Aggregated location statistics ─────────────

/**
 * When a game status changes to 'finished', update location-level stats.
 * Also updates when game opens (to count total games).
 */
export const onGameStatsUpdate = onDocumentUpdated(
  'locations/{locationId}/games/{gameId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const { locationId } = event.params;

    // Only compute stats when game finishes
    if (before.status === after.status || after.status !== 'finished') return;

    try {
      // Query all finished games for this location
      const gamesSnap = await db
        .collection(`locations/${locationId}/games`)
        .where('status', '==', 'finished')
        .get();

      let totalCoupons = 0;
      let totalWinners = 0;
      let totalPlayers = 0;
      let lastGameAt: FirebaseFirestore.Timestamp | null = null;

      for (const gameDoc of gamesSnap.docs) {
        const game = gameDoc.data();
        totalCoupons += game.couponCount ?? 0;
        totalWinners += game.winners?.length ?? 0;
        totalPlayers += game.playerCount ?? 0;

        const finishedAt = game.finishedAt as FirebaseFirestore.Timestamp | null;
        if (finishedAt && (!lastGameAt || finishedAt.toMillis() > lastGameAt.toMillis())) {
          lastGameAt = finishedAt;
        }
      }

      const totalGames = gamesSnap.size;
      const statsRef = db.doc(`locations/${locationId}/meta/stats`);

      await statsRef.set({
        totalGames,
        totalCoupons,
        totalWinners,
        totalPlayers,
        averagePlayersPerGame: totalGames > 0 ? Math.round(totalPlayers / totalGames) : 0,
        averageCouponsPerGame: totalGames > 0 ? Math.round(totalCoupons / totalGames) : 0,
        lastGameAt,
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info('Updated location stats', { locationId, totalGames, totalCoupons });
    } catch (error) {
      logger.error('Failed to update location stats', { locationId, error });
    }
  }
);

// ─── CF-013: Player leaderboard ─────────────────────────

/**
 * When a game's winners array changes, update the leaderboard
 * for the location. Also increments gamesPlayed for all coupon owners.
 */
export const onWinnerLeaderboardUpdate = onDocumentUpdated(
  'locations/{locationId}/games/{gameId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const { locationId, gameId } = event.params;
    const beforeWinners = before.winners ?? [];
    const afterWinners = after.winners ?? [];

    // Check if winners were added
    if (afterWinners.length <= beforeWinners.length) return;

    const newWinners = afterWinners.slice(beforeWinners.length) as Array<{
      userId: string;
      displayName: string;
      couponId: string;
      winCondition: string;
    }>;

    try {
      for (const winner of newWinners) {
        const leaderboardRef = db.doc(
          `locations/${locationId}/leaderboard/${winner.userId}`
        );

        const existing = await leaderboardRef.get();

        if (existing.exists) {
          await leaderboardRef.update({
            wins: FieldValue.increment(1),
            displayName: winner.displayName,
            lastWinAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          await leaderboardRef.set({
            userId: winner.userId,
            displayName: winner.displayName,
            wins: 1,
            gamesPlayed: 0,
            lastWinAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      logger.info('Updated leaderboard', {
        locationId,
        gameId,
        newWinners: newWinners.length,
      });
    } catch (error) {
      logger.error('Failed to update leaderboard', { locationId, error });
    }
  }
);

/**
 * When a game finishes, increment gamesPlayed for all participants.
 */
export const onGameFinishedUpdateLeaderboard = onDocumentUpdated(
  'locations/{locationId}/games/{gameId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    if (before.status === after.status || after.status !== 'finished') return;

    const { locationId, gameId } = event.params;

    try {
      // Get all coupons for this game to find unique players
      const couponsSnap = await db
        .collection(`locations/${locationId}/games/${gameId}/coupons`)
        .get();

      const playerIds = new Set<string>();
      const playerNames = new Map<string, string>();

      for (const couponDoc of couponsSnap.docs) {
        const coupon = couponDoc.data();
        playerIds.add(coupon.userId);
        playerNames.set(coupon.userId, coupon.userDisplayName);
      }

      // Batch update gamesPlayed for each participant
      const batch = db.batch();
      for (const userId of playerIds) {
        const leaderboardRef = db.doc(
          `locations/${locationId}/leaderboard/${userId}`
        );

        const existing = await leaderboardRef.get();
        if (existing.exists) {
          batch.update(leaderboardRef, {
            gamesPlayed: FieldValue.increment(1),
            displayName: playerNames.get(userId) ?? 'Ukjent',
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          batch.set(leaderboardRef, {
            userId,
            displayName: playerNames.get(userId) ?? 'Ukjent',
            wins: 0,
            gamesPlayed: 1,
            lastWinAt: null,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      await batch.commit();

      logger.info('Updated gamesPlayed for participants', {
        locationId,
        gameId,
        playerCount: playerIds.size,
      });
    } catch (error) {
      logger.error('Failed to update gamesPlayed', { locationId, error });
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

// ─── CF-008: Cheat detection ─────────────────────────────
// When a coupon is created, check for suspicious patterns:
// 1. Duplicate numbers on the coupon
// 2. User has too many bingo claims in a short time window

export const onCouponCheatCheck = onDocumentCreated(
  'locations/{locationId}/games/{gameId}/coupons/{couponId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const coupon = snap.data();
    const { locationId, gameId, couponId } = event.params;
    const flags: string[] = [];

    // Check 1: Duplicate numbers on the coupon (should be impossible but verify)
    const numbers: number[] = coupon.numbers ?? [];
    const freeCenter = numbers.length === 25; // center cell is 0 (free space)
    const nonFreeNumbers = freeCenter
      ? numbers.filter((_: number, i: number) => i !== 12)
      : numbers;
    const uniqueNumbers = new Set(nonFreeNumbers.filter((n: number) => n !== 0));
    if (uniqueNumbers.size < nonFreeNumbers.filter((n: number) => n !== 0).length) {
      flags.push('duplicate_numbers');
    }

    // Check 2: Numbers outside valid bingo range (1-75)
    for (const num of nonFreeNumbers) {
      if (num !== 0 && (num < 1 || num > 75)) {
        flags.push('invalid_number_range');
        break;
      }
    }

    // Check 3: Numbers not in correct column ranges (B:1-15, I:16-30, N:31-45, G:46-60, O:61-75)
    const columnRanges = [
      [1, 15], [16, 30], [31, 45], [46, 60], [61, 75],
    ];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const idx = row * 5 + col;
        const num = numbers[idx];
        if (num === 0) continue; // free space
        const [min, max] = columnRanges[col]!;
        if (num < min! || num > max!) {
          flags.push('wrong_column_placement');
          break;
        }
      }
      if (flags.includes('wrong_column_placement')) break;
    }

    if (flags.length > 0) {
      // Flag the coupon
      await snap.ref.update({
        cheatFlags: flags,
        flaggedAt: FieldValue.serverTimestamp(),
      });

      // Notify admins
      const locationSnap = await db.doc(`locations/${locationId}`).get();
      const adminUids: string[] = locationSnap.data()?.adminUids ?? [];
      const locationName = locationSnap.data()?.name ?? 'Bingo';

      const tokens: string[] = [];
      for (const uid of adminUids) {
        const tokenSnap = await db.collection(`users/${uid}/fcmTokens`).get();
        tokenSnap.docs.forEach((d) => tokens.push(d.data().token));
      }

      await sendToTokens(
        tokens,
        'Mistenkelig kupong oppdaget!',
        `Kupong fra ${coupon.userDisplayName} hos ${locationName} har flagg: ${flags.join(', ')}`,
        `/admin/${locationId}`
      );

      logger.warn('Cheat flags detected on coupon', {
        locationId, gameId, couponId,
        userId: coupon.userId,
        flags,
      });
    }
  }
);

/**
 * CF-008b: Monitor bingo claims for suspicious patterns.
 * Checks if a user has submitted too many claims in a short time.
 */
export const onClaimCheatCheck = onDocumentCreated(
  'locations/{locationId}/games/{gameId}/bingo_claims/{claimId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const claim = snap.data();
    const { locationId, gameId } = event.params;
    const flags: string[] = [];

    // Check: Too many claims from same user in this game (>3 is suspicious)
    const userClaimsSnap = await db
      .collection(`locations/${locationId}/games/${gameId}/bingo_claims`)
      .where('userId', '==', claim.userId)
      .get();

    if (userClaimsSnap.size > 3) {
      flags.push(`excessive_claims:${userClaimsSnap.size}`);
    }

    if (flags.length > 0) {
      await snap.ref.update({
        cheatFlags: flags,
        flaggedAt: FieldValue.serverTimestamp(),
      });

      logger.warn('Suspicious bingo claim pattern', {
        locationId, gameId,
        userId: claim.userId,
        claimCount: userClaimsSnap.size,
        flags,
      });
    }
  }
);

// ─── CF-009: Rate limiting on coupon purchases ───────────
// When a coupon is created, check if the user has bought too many
// coupons in the last 5 minutes (across all games at this location).

export const onCouponRateLimit = onDocumentCreated(
  'locations/{locationId}/games/{gameId}/coupons/{couponId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const coupon = snap.data();
    const { locationId, gameId } = event.params;

    const fiveMinutesAgo = Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);

    // Count coupons this user bought in the last 5 minutes for this game
    const recentCouponsSnap = await db
      .collection(`locations/${locationId}/games/${gameId}/coupons`)
      .where('userId', '==', coupon.userId)
      .where('purchasedAt', '>', fiveMinutesAgo)
      .get();

    const MAX_COUPONS_PER_5_MIN = 10;

    if (recentCouponsSnap.size > MAX_COUPONS_PER_5_MIN) {
      // Flag the coupon and notify admins
      await snap.ref.update({
        rateLimited: true,
        rateLimitFlags: [`${recentCouponsSnap.size}_in_5min`],
        flaggedAt: FieldValue.serverTimestamp(),
      });

      const locationSnap = await db.doc(`locations/${locationId}`).get();
      const adminUids: string[] = locationSnap.data()?.adminUids ?? [];
      const locationName = locationSnap.data()?.name ?? 'Bingo';

      const tokens: string[] = [];
      for (const uid of adminUids) {
        const tokenSnap = await db.collection(`users/${uid}/fcmTokens`).get();
        tokenSnap.docs.forEach((d) => tokens.push(d.data().token));
      }

      await sendToTokens(
        tokens,
        'Rate limit overskrevet!',
        `${coupon.userDisplayName} har kjøpt ${recentCouponsSnap.size} kuponger på 5 min hos ${locationName}`,
        `/admin/${locationId}`
      );

      logger.warn('Rate limit exceeded for coupon purchase', {
        locationId, gameId,
        userId: coupon.userId,
        recentCount: recentCouponsSnap.size,
      });
    }
  }
);

// ─── CF-016: Tournament mode ─────────────────────────────
// When a game finishes and the location has tournament mode enabled,
// track round scores and manage multi-round tournaments.

export const onTournamentRoundFinished = onDocumentUpdated(
  'locations/{locationId}/games/{gameId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger when game finishes
    if (before.status === after.status || after.status !== 'finished') return;
    // Only for tournament games
    if (!after.tournamentId) return;

    const { locationId, gameId } = event.params;
    const tournamentId = after.tournamentId as string;

    try {
      const tournamentRef = db.doc(`locations/${locationId}/tournaments/${tournamentId}`);
      const tournamentSnap = await tournamentRef.get();
      if (!tournamentSnap.exists) return;

      const tournament = tournamentSnap.data()!;
      const roundNumber = (tournament.completedRounds ?? 0) + 1;
      const totalRounds = tournament.totalRounds ?? 3;

      // Calculate points for this round
      const winners = (after.winners ?? []) as Array<{
        userId: string;
        displayName: string;
        winCondition: string;
      }>;

      // Points: 1st bingo = 3pts, 2nd = 2pts, 3rd = 1pt
      const roundScores: Record<string, { displayName: string; points: number }> = {};
      winners.forEach((w, idx) => {
        const points = Math.max(3 - idx, 1);
        if (roundScores[w.userId]) {
          roundScores[w.userId]!.points += points;
        } else {
          roundScores[w.userId] = { displayName: w.displayName, points };
        }
      });

      // Save round result
      const roundRef = db.doc(
        `locations/${locationId}/tournaments/${tournamentId}/rounds/${gameId}`
      );
      await roundRef.set({
        roundNumber,
        gameId,
        scores: roundScores,
        completedAt: FieldValue.serverTimestamp(),
      });

      // Update tournament standings
      const allRoundsSnap = await db
        .collection(`locations/${locationId}/tournaments/${tournamentId}/rounds`)
        .get();

      const totalScores: Record<string, { displayName: string; totalPoints: number; roundsPlayed: number }> = {};
      for (const roundDoc of allRoundsSnap.docs) {
        const roundData = roundDoc.data();
        const scores = roundData.scores as Record<string, { displayName: string; points: number }>;
        for (const [userId, data] of Object.entries(scores)) {
          if (totalScores[userId]) {
            totalScores[userId]!.totalPoints += data.points;
            totalScores[userId]!.roundsPlayed += 1;
          } else {
            totalScores[userId] = {
              displayName: data.displayName,
              totalPoints: data.points,
              roundsPlayed: 1,
            };
          }
        }
      }

      // Sort standings by points
      const standings = Object.entries(totalScores)
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

      const isComplete = roundNumber >= totalRounds;

      await tournamentRef.update({
        completedRounds: roundNumber,
        standings,
        status: isComplete ? 'finished' : 'active',
        currentGameId: isComplete ? null : tournament.currentGameId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (isComplete && standings.length > 0) {
        // Notify about tournament winner
        const locationSnap = await db.doc(`locations/${locationId}`).get();
        const locationName = locationSnap.data()?.name ?? 'Bingo';

        const tokens = await getTokensForLocation(locationId);
        await sendToTokens(
          tokens,
          'Turnering avsluttet!',
          `${standings[0]!.displayName} vant turneringen hos ${locationName} med ${standings[0]!.totalPoints} poeng!`,
          `/spill/${locationId}`
        );
      }

      logger.info('Tournament round completed', {
        locationId, tournamentId, roundNumber,
        isComplete,
        standingsCount: standings.length,
      });
    } catch (error) {
      logger.error('Failed to process tournament round', { locationId, gameId, error });
    }
  }
);

// ─── CF-018: Firestore backup ────────────────────────────
// Runs daily at 02:00 CET. Exports Firestore to Cloud Storage
// using the Firestore Admin REST API via google-auth-library.

export const dailyFirestoreBackup = onSchedule(
  { schedule: 'every day 02:00', timeZone: 'Europe/Oslo', timeoutSeconds: 300 },
  async () => {
    try {
      const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'bingo-42fe1';
      const bucketName = `${projectId}-firestore-backups`;
      const date = new Date().toISOString().split('T')[0];
      const outputUri = `gs://${bucketName}/${date}`;

      // Use google-auth-library to get an access token
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] });
      const client = await auth.getClient();
      const token = await client.getAccessToken();

      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outputUriPrefix: outputUri,
          collectionIds: [], // all collections
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backup API returned ${response.status}: ${errorText}`);
      }

      logger.info('Firestore backup started', { outputUri });
    } catch (error) {
      logger.error('Firestore backup failed', error);
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
