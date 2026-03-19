import type { CouponGrid, WinCondition } from '@/types';
import { GRID_SIZE, FREE_CELL_INDEX } from './constants';

/**
 * Check if a coupon has achieved a specific win condition.
 * Uses flat 25-element arrays (row-major order).
 * Note: Win is determined solely by drawn numbers, not manual marks.
 */
export function checkWinCondition(
  numbers: CouponGrid,
  drawnNumbers: Set<number>,
  condition: WinCondition
): boolean {
  // First, compute effective marks: cell is marked if drawn or free space
  const effective = computeEffectiveMarks(numbers, drawnNumbers);

  switch (condition) {
    case 'row':
      return checkRows(effective);
    case 'column':
      return checkColumns(effective);
    case 'diagonal':
      return checkDiagonals(effective);
    case 'full_board':
      return checkFullBoard(effective);
  }
}

/**
 * Compute which cells are effectively marked based on drawn numbers.
 * A cell is marked if its number has been drawn, or if it's the free space.
 */
function computeEffectiveMarks(numbers: CouponGrid, drawnNumbers: Set<number>): boolean[] {
  return numbers.map((num, index) => {
    if (index === FREE_CELL_INDEX) return true;
    return drawnNumbers.has(num);
  });
}

function checkRows(marks: boolean[]): boolean {
  for (let row = 0; row < GRID_SIZE; row++) {
    let complete = true;
    for (let col = 0; col < GRID_SIZE; col++) {
      if (!marks[row * GRID_SIZE + col]) {
        complete = false;
        break;
      }
    }
    if (complete) return true;
  }
  return false;
}

function checkColumns(marks: boolean[]): boolean {
  for (let col = 0; col < GRID_SIZE; col++) {
    let complete = true;
    for (let row = 0; row < GRID_SIZE; row++) {
      if (!marks[row * GRID_SIZE + col]) {
        complete = false;
        break;
      }
    }
    if (complete) return true;
  }
  return false;
}

function checkDiagonals(marks: boolean[]): boolean {
  // Top-left to bottom-right
  let diag1 = true;
  for (let i = 0; i < GRID_SIZE; i++) {
    if (!marks[i * GRID_SIZE + i]) {
      diag1 = false;
      break;
    }
  }
  if (diag1) return true;

  // Top-right to bottom-left
  let diag2 = true;
  for (let i = 0; i < GRID_SIZE; i++) {
    if (!marks[i * GRID_SIZE + (GRID_SIZE - 1 - i)]) {
      diag2 = false;
      break;
    }
  }
  return diag2;
}

function checkFullBoard(marks: boolean[]): boolean {
  return marks.every(Boolean);
}

/**
 * Check all win conditions and return the first matching one, or null.
 */
export function findWinCondition(
  numbers: CouponGrid,
  drawnNumbers: Set<number>,
  activeConditions: WinCondition[]
): WinCondition | null {
  for (const condition of activeConditions) {
    if (checkWinCondition(numbers, drawnNumbers, condition)) {
      return condition;
    }
  }
  return null;
}

/**
 * Count how many cells remain unmarked for the closest win condition.
 * Returns the minimum remaining count across all active conditions.
 */
export function countRemainingForWin(
  numbers: CouponGrid,
  drawnNumbers: Set<number>,
  activeConditions: WinCondition[]
): number {
  const effective = computeEffectiveMarks(numbers, drawnNumbers);
  let minRemaining = GRID_SIZE * GRID_SIZE;

  for (const condition of activeConditions) {
    const remaining = countRemainingForCondition(effective, condition);
    if (remaining < minRemaining) {
      minRemaining = remaining;
    }
  }

  return minRemaining;
}

function countRemainingForCondition(marks: boolean[], condition: WinCondition): number {
  switch (condition) {
    case 'row':
      return bestLineRemaining(marks, 'row');
    case 'column':
      return bestLineRemaining(marks, 'column');
    case 'diagonal':
      return bestDiagonalRemaining(marks);
    case 'full_board':
      return marks.filter(m => !m).length;
  }
}

function bestLineRemaining(marks: boolean[], type: 'row' | 'column'): number {
  let best = GRID_SIZE;
  for (let i = 0; i < GRID_SIZE; i++) {
    let unmarked = 0;
    for (let j = 0; j < GRID_SIZE; j++) {
      const index = type === 'row' ? i * GRID_SIZE + j : j * GRID_SIZE + i;
      if (!marks[index]) unmarked++;
    }
    if (unmarked < best) best = unmarked;
  }
  return best;
}

function bestDiagonalRemaining(marks: boolean[]): number {
  let d1 = 0;
  let d2 = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    if (!marks[i * GRID_SIZE + i]) d1++;
    if (!marks[i * GRID_SIZE + (GRID_SIZE - 1 - i)]) d2++;
  }
  return Math.min(d1, d2);
}

/**
 * Validate that a coupon grid has correct format and values.
 * Used for client-side pre-validation before Firestore write.
 */
export function isValidCouponGrid(grid: CouponGrid): boolean {
  if (grid.length !== GRID_SIZE * GRID_SIZE) return false;

  // Check free cell
  if (grid[FREE_CELL_INDEX] !== 0) return false;

  // Check each column
  for (let col = 0; col < GRID_SIZE; col++) {
    const min = col * 15 + 1;
    const max = (col + 1) * 15;
    const seen = new Set<number>();

    for (let row = 0; row < GRID_SIZE; row++) {
      const index = row * GRID_SIZE + col;
      const val = grid[index]!;

      // Skip free cell
      if (index === FREE_CELL_INDEX) continue;

      if (val < min || val > max) return false;
      if (seen.has(val)) return false;
      seen.add(val);
    }
  }

  return true;
}
