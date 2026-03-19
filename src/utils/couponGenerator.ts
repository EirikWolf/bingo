import type { CouponGrid, MarkedGrid } from '@/types';
import { GRID_SIZE, FREE_CELL_INDEX } from './constants';
import { COLUMN_RANGES } from './constants';

/**
 * Generate a random bingo coupon as a flat 25-element array (row-major order).
 *
 * Layout (row-major):
 *   index = row * 5 + col
 *   col 0 = B (1-15), col 1 = I (16-30), col 2 = N (31-45), col 3 = G (46-60), col 4 = O (61-75)
 *   Center cell (index 12, row 2 col 2) = 0 (free space)
 */
export function generateCouponNumbers(): CouponGrid {
  const grid: number[] = new Array<number>(GRID_SIZE * GRID_SIZE).fill(0);

  for (let col = 0; col < GRID_SIZE; col++) {
    const range = COLUMN_RANGES[col];
    if (!range) throw new Error(`No range for column ${col}`);

    const count = col === 2 ? 4 : 5; // N-column has 4 numbers + free space
    const selected = pickRandom(range.min, range.max, count);

    let selectedIndex = 0;
    for (let row = 0; row < GRID_SIZE; row++) {
      const flatIndex = row * GRID_SIZE + col;

      // Skip center cell for N-column
      if (flatIndex === FREE_CELL_INDEX) {
        grid[flatIndex] = 0;
        continue;
      }

      grid[flatIndex] = selected[selectedIndex]!;
      selectedIndex++;
    }
  }

  return grid;
}

/**
 * Create an empty marked grid. Center cell starts as true (free space).
 */
export function createEmptyMarkedGrid(): MarkedGrid {
  const grid: boolean[] = new Array<boolean>(GRID_SIZE * GRID_SIZE).fill(false);
  grid[FREE_CELL_INDEX] = true;
  return grid;
}

/**
 * Pick `count` unique random numbers from [min, max] inclusive.
 */
function pickRandom(min: number, max: number, count: number): number[] {
  const available: number[] = [];
  for (let i = min; i <= max; i++) {
    available.push(i);
  }

  // Fisher-Yates shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j]!, available[i]!];
  }

  return available.slice(0, count);
}

/**
 * Get the value at (row, col) in a flat coupon grid.
 */
export function getCellValue(grid: CouponGrid, row: number, col: number): number {
  return grid[row * GRID_SIZE + col] ?? 0;
}

/**
 * Check if a cell is marked in a flat marked grid.
 */
export function isCellMarked(grid: MarkedGrid, row: number, col: number): boolean {
  return grid[row * GRID_SIZE + col] ?? false;
}
