import type { WinCondition } from '@/types';

// ─── Bingo columns ──────────────────────────────────────
export const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;

export const COLUMN_RANGES: Record<number, { min: number; max: number }> = {
  0: { min: 1, max: 15 },   // B
  1: { min: 16, max: 30 },  // I
  2: { min: 31, max: 45 },  // N
  3: { min: 46, max: 60 },  // G
  4: { min: 61, max: 75 },  // O
};

export const TOTAL_NUMBERS = 75;

// ─── Ball colors (Tailwind class names) ──────────────────
export const BALL_COLORS: Record<number, string> = {
  0: 'bg-ball-b', // B: 1-15
  1: 'bg-ball-i', // I: 16-30
  2: 'bg-ball-n', // N: 31-45
  3: 'bg-ball-g', // G: 46-60
  4: 'bg-ball-o', // O: 61-75
};

/** Get the column index (0-4) for a bingo number (1-75) */
export function getColumnForNumber(num: number): number {
  if (num < 1 || num > 75) throw new Error(`Invalid bingo number: ${num}`);
  return Math.floor((num - 1) / 15);
}

/** Get the ball color class for a bingo number */
export function getBallColor(num: number): string {
  const col = getColumnForNumber(num);
  return BALL_COLORS[col] ?? 'bg-gray-400';
}

/** Get the letter for a bingo number */
export function getLetterForNumber(num: number): string {
  const col = getColumnForNumber(num);
  return BINGO_LETTERS[col] ?? '';
}

// ─── Win condition labels (Norwegian) ────────────────────
export const WIN_CONDITION_LABELS: Record<WinCondition, string> = {
  row: 'Rad',
  column: 'Kolonne',
  diagonal: 'Diagonal',
  full_board: 'Full plate',
};

// ─── Game status labels (Norwegian) ─────────────────────
export const GAME_STATUS_LABELS: Record<string, string> = {
  setup: 'Klargjøring',
  open: 'Åpent for kjøp',
  active: 'Pågår',
  paused: 'Pause',
  finished: 'Avsluttet',
};

// ─── Valid state transitions ─────────────────────────────
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  setup: ['open'],
  open: ['active'],
  active: ['paused', 'finished'],
  paused: ['active', 'finished'],
  finished: [],
};

// ─── Grid constants ──────────────────────────────────────
export const GRID_SIZE = 5;
export const FREE_CELL_INDEX = 12; // center of 5x5 grid (row 2, col 2)
