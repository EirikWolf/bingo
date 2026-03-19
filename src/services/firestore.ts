import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  type DocumentReference,
  type CollectionReference,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Location, Game, Coupon, BingoClaim, Commitment, User, LocationStats, LeaderboardEntry } from '@/types';

// ─── Document references ─────────────────────────────────

export function userRef(uid: string): DocumentReference {
  return doc(db, 'users', uid);
}

export function locationRef(locationId: string): DocumentReference {
  return doc(db, 'locations', locationId);
}

export function gameRef(locationId: string, gameId: string): DocumentReference {
  return doc(db, 'locations', locationId, 'games', gameId);
}

export function couponRef(locationId: string, gameId: string, couponId: string): DocumentReference {
  return doc(db, 'locations', locationId, 'games', gameId, 'coupons', couponId);
}

// ─── Collection references ───────────────────────────────

export function locationsCol(): CollectionReference {
  return collection(db, 'locations');
}

export function gamesCol(locationId: string): CollectionReference {
  return collection(db, 'locations', locationId, 'games');
}

export function couponsCol(locationId: string, gameId: string): CollectionReference {
  return collection(db, 'locations', locationId, 'games', gameId, 'coupons');
}

export function claimsCol(locationId: string, gameId: string): CollectionReference {
  return collection(db, 'locations', locationId, 'games', gameId, 'bingo_claims');
}

export function commitmentsCol(): CollectionReference {
  return collection(db, 'commitments');
}

// ─── Realtime listeners ──────────────────────────────────

/** Listen to all locations */
export function listenToLocations(
  callback: (locations: Location[]) => void
): () => void {
  const q = query(locationsCol(), orderBy('name'));
  return onSnapshot(q, (snap) => {
    const locations = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Location);
    callback(locations);
  }, (error) => {
    console.error('listenToLocations error:', error);
    callback([]);
  });
}

/** Listen to a single location */
export function listenToLocation(
  locationId: string,
  callback: (location: Location | null) => void
): () => void {
  return onSnapshot(locationRef(locationId), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() } as Location);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('listenToLocation error:', error);
    callback(null);
  });
}

/** Listen to a specific game */
export function listenToGame(
  locationId: string,
  gameId: string,
  callback: (game: Game | null) => void
): () => void {
  return onSnapshot(gameRef(locationId, gameId), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() } as Game);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('listenToGame error:', error);
    callback(null);
  });
}

/** Listen to a user's coupons for a specific game */
export function listenToUserCoupons(
  locationId: string,
  gameId: string,
  userId: string,
  callback: (coupons: Coupon[]) => void
): () => void {
  const q = query(
    couponsCol(locationId, gameId),
    where('userId', '==', userId),
    orderBy('purchasedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const coupons = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Coupon);
    callback(coupons);
  }, (error) => {
    console.error('listenToUserCoupons error:', error);
    callback([]);
  });
}

/** Listen to all coupons for a game (admin use) */
export function listenToGameCoupons(
  locationId: string,
  gameId: string,
  callback: (coupons: Coupon[]) => void
): () => void {
  const q = query(couponsCol(locationId, gameId), orderBy('purchasedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const coupons = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Coupon);
    callback(coupons);
  }, (error) => {
    console.error('listenToGameCoupons error:', error);
    callback([]);
  });
}

/** Listen to pending bingo claims for a game */
export function listenToPendingClaims(
  locationId: string,
  gameId: string,
  callback: (claims: BingoClaim[]) => void
): () => void {
  const q = query(
    claimsCol(locationId, gameId),
    where('status', '==', 'pending'),
    orderBy('claimedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const claims = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BingoClaim);
    callback(claims);
  }, (error) => {
    console.error('listenToPendingClaims error:', error);
    callback([]);
  });
}

/** Listen to commitments for a user */
export function listenToUserCommitments(
  userId: string,
  callback: (commitments: Commitment[]) => void
): () => void {
  const q = query(
    commitmentsCol(),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const commitments = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Commitment);
    callback(commitments);
  }, (error) => {
    console.error('listenToUserCommitments error:', error);
    callback([]);
  });
}

/** Listen to commitments for a location (admin use) */
export function listenToLocationCommitments(
  locationId: string,
  callback: (commitments: Commitment[]) => void
): () => void {
  const q = query(
    commitmentsCol(),
    where('locationId', '==', locationId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const commitments = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Commitment);
    callback(commitments);
  }, (error) => {
    console.error('listenToLocationCommitments error:', error);
    callback([]);
  });
}

/** Listen to finished games for a location (history) */
export function listenToFinishedGames(
  locationId: string,
  callback: (games: Game[]) => void
): () => void {
  const q = query(
    gamesCol(locationId),
    where('status', '==', 'finished'),
    orderBy('finishedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const games = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Game);
    callback(games);
  }, (error) => {
    console.error('listenToFinishedGames error:', error);
    callback([]);
  });
}

/** Listen to all users (superadmin use) */
export function listenToAllUsers(
  callback: (users: User[]) => void
): () => void {
  const q = query(collection(db, 'users'), orderBy('displayName'));
  return onSnapshot(q, (snap) => {
    const users = snap.docs.map((d) => ({ ...d.data(), uid: d.id }) as User);
    callback(users);
  }, (error) => {
    console.error('listenToAllUsers error:', error);
    callback([]);
  });
}

// ─── Fetch users by UIDs ─────────────────────────────────

export async function fetchUsersByUids(uids: string[]): Promise<User[]> {
  const results = await Promise.all(
    uids.map(async (uid) => {
      const snap = await getDoc(userRef(uid));
      if (snap.exists()) {
        return { ...snap.data(), uid: snap.id } as User;
      }
      return { uid, displayName: uid, email: '', role: 'player', createdAt: null } as unknown as User;
    })
  );
  return results;
}

// ─── Location stats (updated by Cloud Function) ─────────

export function listenToLocationStats(
  locationId: string,
  callback: (stats: LocationStats | null) => void
): () => void {
  return onSnapshot(
    doc(db, 'locations', locationId, 'meta', 'stats'),
    (snap) => {
      callback(snap.exists() ? (snap.data() as LocationStats) : null);
    },
    (error) => {
      console.error('listenToLocationStats error:', error);
      callback(null);
    }
  );
}

// ─── Leaderboard (updated by Cloud Function) ─────────────

export function listenToLeaderboard(
  locationId: string,
  callback: (entries: LeaderboardEntry[]) => void
): () => void {
  const q = query(
    collection(db, 'locations', locationId, 'leaderboard'),
    orderBy('wins', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => ({ ...d.data() }) as LeaderboardEntry);
    callback(entries);
  }, (error) => {
    console.error('listenToLeaderboard error:', error);
    callback([]);
  });
}
