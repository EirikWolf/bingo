import { Timestamp } from 'firebase/firestore';

// ─── Roles ───────────────────────────────────────────────
export type UserRole = 'player' | 'admin' | 'superadmin';

// ─── Win conditions ──────────────────────────────────────
export type WinCondition = 'row' | 'column' | 'diagonal' | 'full_board';

// ─── Game status machine ─────────────────────────────────
// setup → open → active ↔ paused
//                  ↓         ↓
//              finished  finished
export type GameStatus = 'setup' | 'open' | 'active' | 'paused' | 'finished';

// ─── Claim status ────────────────────────────────────────
export type ClaimStatus = 'pending' | 'approved' | 'rejected';

// ─── Commitment status ───────────────────────────────────
export type CommitmentStatus = 'pending' | 'confirmed' | 'overdue' | 'cancelled';

// ─── Coupon grid types ───────────────────────────────────
// Flat 25-element arrays to avoid Firestore nested-array limitation
export type CouponGrid = number[];       // length 25, row-major order
export type MarkedGrid = boolean[];      // length 25, row-major order

// ─── Users ───────────────────────────────────────────────
export interface User {
  uid: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  photoURL: string | null;
  role: UserRole;
  activeLocationId: string | null;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
}

// ─── Locations ───────────────────────────────────────────
export interface CommitmentLevel {
  label: string;
  description: string;
}

export interface SpeechSettings {
  enabled: boolean;
  voiceURI: string | null;
  rate: number;   // 0.5 - 2.0
  volume: number; // 0.0 - 1.0
}

export interface LocationSettings {
  maxCouponsPerPlayer: number;
  defaultCommitment: string;
  commitmentLevels: CommitmentLevel[];
  allowAnonymous: boolean;
  autoDrawEnabled: boolean;
  autoDrawIntervalMs: number;
  winConditions: WinCondition[];
  vippsNumber: string | null;
  vippsDefaultAmount: number | null;
  reminderEnabled: boolean;
  speech: SpeechSettings;
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

// ─── Games ───────────────────────────────────────────────
export interface Winner {
  userId: string;
  displayName: string;
  couponId: string;
  winCondition: WinCondition;
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
  autoDrawActive: boolean;
  autoDrawIntervalMs: number;
  lastDrawAt: Timestamp | null;
  createdAt: Timestamp;
  startedAt: Timestamp | null;
  finishedAt: Timestamp | null;
}

// ─── Coupons ─────────────────────────────────────────────
export interface Coupon {
  id: string;
  userId: string;
  userDisplayName: string;
  numbers: CouponGrid;           // flat 25 elements, row-major
  markedCells: MarkedGrid;       // flat 25 elements, row-major
  commitmentId: string;
  isWinner: boolean;
  winCondition: WinCondition | null;
  purchasedAt: Timestamp;
}

// ─── Bingo claims ────────────────────────────────────────
export interface BingoClaim {
  id: string;
  userId: string;
  userDisplayName: string;
  couponId: string;
  status: ClaimStatus;
  suggestedWinCondition: WinCondition | null;
  approvedWinCondition: WinCondition | null;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  claimedAt: Timestamp;
}

// ─── Commitments ─────────────────────────────────────────
export interface Commitment {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhone: string | null;
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

// Re-export grid constants from the canonical source
export { GRID_SIZE } from '@/utils/constants';
