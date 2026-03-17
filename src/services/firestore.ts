import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  type Query,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Location, Game, Coupon, Commitment, BingoClaim } from '@/types';

// ============================================================
// Samlingsreferanser
// ============================================================

export const usersRef = () => collection(db, 'users');
export const userRef = (uid: string) => doc(db, 'users', uid);

export const locationsRef = () => collection(db, 'locations');
export const locationRef = (locationId: string) => doc(db, 'locations', locationId);

export const gamesRef = (locationId: string) =>
  collection(db, 'locations', locationId, 'games');
export const gameRef = (locationId: string, gameId: string) =>
  doc(db, 'locations', locationId, 'games', gameId);

export const couponsRef = (locationId: string, gameId: string) =>
  collection(db, 'locations', locationId, 'games', gameId, 'coupons');
export const couponRef = (locationId: string, gameId: string, couponId: string) =>
  doc(db, 'locations', locationId, 'games', gameId, 'coupons', couponId);

export const bingoClaimsRef = (locationId: string, gameId: string) =>
  collection(db, 'locations', locationId, 'games', gameId, 'bingo_claims');
export const bingoClaimRef = (locationId: string, gameId: string, claimId: string) =>
  doc(db, 'locations', locationId, 'games', gameId, 'bingo_claims', claimId);

export const commitmentsRef = () => collection(db, 'commitments');

// ============================================================
// Queries
// ============================================================

export const activeGameQuery = (locationId: string): Query =>
  query(gamesRef(locationId), where('status', 'in', ['open', 'active', 'paused']), orderBy('createdAt', 'desc'));

export const userCouponsQuery = (locationId: string, gameId: string, userId: string): Query =>
  query(couponsRef(locationId, gameId), where('userId', '==', userId));

export const userCommitmentsQuery = (userId: string): Query =>
  query(commitmentsRef(), where('userId', '==', userId), orderBy('createdAt', 'desc'));

export const locationCommitmentsQuery = (locationId: string): Query =>
  query(commitmentsRef(), where('locationId', '==', locationId), orderBy('createdAt', 'desc'));

export const pendingClaimsQuery = (locationId: string, gameId: string): Query =>
  query(bingoClaimsRef(locationId, gameId), where('status', '==', 'pending'));

// ============================================================
// Sanntidslyttere (returnerer unsubscribe-funksjon)
// ============================================================

export function listenToLocations(callback: (locations: Location[]) => void): () => void {
  return onSnapshot(locationsRef(), (snapshot) => {
    const locations = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Location);
    callback(locations);
  });
}

export function listenToGame(
  locationId: string,
  gameId: string,
  callback: (game: Game | null) => void
): () => void {
  return onSnapshot(gameRef(locationId, gameId), (snapshot) => {
    callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Game) : null);
  });
}

export function listenToActiveGame(
  locationId: string,
  callback: (game: Game | null) => void
): () => void {
  return onSnapshot(activeGameQuery(locationId), (snapshot) => {
    if (snapshot.empty) {
      callback(null);
    } else {
      const firstDoc = snapshot.docs[0];
      callback({ id: firstDoc.id, ...firstDoc.data() } as Game);
    }
  });
}

export function listenToUserCoupons(
  locationId: string,
  gameId: string,
  userId: string,
  callback: (coupons: Coupon[]) => void
): () => void {
  return onSnapshot(userCouponsQuery(locationId, gameId, userId), (snapshot) => {
    const coupons = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Coupon);
    callback(coupons);
  });
}

export function listenToLocation(
  locationId: string,
  callback: (location: Location | null) => void
): () => void {
  return onSnapshot(locationRef(locationId), (snapshot) => {
    callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Location) : null);
  });
}

export function listenToPendingClaims(
  locationId: string,
  gameId: string,
  callback: (claims: BingoClaim[]) => void
): () => void {
  return onSnapshot(pendingClaimsQuery(locationId, gameId), (snapshot) => {
    const claims = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as BingoClaim);
    callback(claims);
  });
}
