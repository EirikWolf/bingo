import { Timestamp } from 'firebase/firestore';

// ============================================================
// Brukerroller
// ============================================================

export type UserRole = 'player' | 'admin' | 'superadmin';

export interface User {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  role: UserRole;
  activeLocationId: string | null;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
}

// ============================================================
// Lokasjoner
// ============================================================

export type WinCondition =
  | 'row'
  | 'column'
  | 'diagonal'
  | 'two_rows'
  | 'full_board'
  | 'four_corners'
  | 'cross';

export interface CommitmentLevel {
  id: string;
  description: string;
  couponsGranted: number;
}

export interface LocationSettings {
  maxCouponsPerPlayer: number;
  defaultCommitment: string;
  commitmentLevels: CommitmentLevel[];
  allowAnonymous: boolean;
  autoDrawEnabled: boolean;
  autoDrawIntervalMs: number;
  winConditions: WinCondition[];
}

export interface Location {
  id: string;
  name: string;
  description: string;
  imageURL: string | null;
  pinCode: string | null;
  adminUids: string[];
  activeGameId: string | null;
  settings: LocationSettings;
  playerCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Spill
// ============================================================

export type GameStatus = 'setup' | 'open' | 'active' | 'paused' | 'finished';

export interface Winner {
  userId: string;
  displayName: string;
  couponId: string;
  winCondition: WinCondition;
  claimedAt: Timestamp;
}

export interface Game {
  id: string;
  status: GameStatus;
  drawnNumbers: number[];
  currentNumber: number | null;
  totalNumbers: number;
  winConditions: WinCondition[];
  winners: Winner[];
  couponCount: number;
  playerCount: number;
  commitment: string;
  createdAt: Timestamp;
  startedAt: Timestamp | null;
  finishedAt: Timestamp | null;
}

// ============================================================
// Kuponger
// ============================================================

/** 5x5 matrise. numbers[rad][kolonne]. Sentrum (2,2) = 0 (fri rute). */
export type CouponGrid = number[][];

/** 5x5 matrise. true = markert. Sentrum alltid true. */
export type MarkedGrid = boolean[][];

export interface Coupon {
  id: string;
  userId: string;
  userDisplayName: string;
  numbers: CouponGrid;
  markedCells: MarkedGrid;
  commitmentId: string;
  isWinner: boolean;
  winCondition: WinCondition | null;
  purchasedAt: Timestamp;
}

// ============================================================
// Bingo-rop (erstatter Cloud Function-validering)
// ============================================================

export type BingoClaimStatus = 'pending' | 'approved' | 'rejected';

export interface BingoClaim {
  id: string;
  userId: string;
  userDisplayName: string;
  couponId: string;
  status: BingoClaimStatus;
  /** Klientsiden foreslår gevinsttype, admin bekrefter */
  suggestedWinCondition: WinCondition | null;
  /** Admin setter endelig gevinsttype ved godkjenning */
  approvedWinCondition: WinCondition | null;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  claimedAt: Timestamp;
}

// ============================================================
// Forpliktelser
// ============================================================

export type CommitmentStatus = 'pending' | 'confirmed' | 'overdue' | 'cancelled';

export interface Commitment {
  id: string;
  userId: string;
  userDisplayName: string;
  locationId: string;
  locationName: string;
  gameId: string;
  couponId: string;
  description: string;
  status: CommitmentStatus;
  dueDate: Timestamp | null;
  confirmedAt: Timestamp | null;
  confirmedBy: string | null;
  createdAt: Timestamp;
}

// ============================================================
// Bingo-konfigurasjonstyper
// ============================================================

export const BINGO_COLUMNS = {
  B: { index: 0, min: 1, max: 15 },
  I: { index: 1, min: 16, max: 30 },
  N: { index: 2, min: 31, max: 45 },
  G: { index: 3, min: 46, max: 60 },
  O: { index: 4, min: 61, max: 75 },
} as const;

export const TOTAL_NUMBERS = 75;
export const GRID_SIZE = 5;
export const FREE_SPACE_ROW = 2;
export const FREE_SPACE_COL = 2;
