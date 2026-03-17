import { COLUMN_RANGES, BINGO_LETTERS } from './constants';
import { FREE_SPACE_ROW, FREE_SPACE_COL, GRID_SIZE } from '@/types';
import type { CouponGrid, MarkedGrid } from '@/types';

/**
 * Generer tilfeldig kupong-rutenett.
 *
 * MERK: Denne brukes kun for forhåndsvisning/testing på klientsiden.
 * Faktiske kuponger genereres i Cloud Functions for integritetssikring.
 */
export function generateCouponNumbers(): CouponGrid {
  const grid: CouponGrid = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    grid[row] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      grid[row][col] = 0; // Placeholder
    }
  }

  // Generer tall per kolonne
  for (let col = 0; col < GRID_SIZE; col++) {
    const letter = BINGO_LETTERS[col];
    const range = COLUMN_RANGES[letter];
    const count = col === FREE_SPACE_COL ? GRID_SIZE - 1 : GRID_SIZE;
    const numbers = pickRandom(range.min, range.max, count);

    let numIdx = 0;
    for (let row = 0; row < GRID_SIZE; row++) {
      if (row === FREE_SPACE_ROW && col === FREE_SPACE_COL) {
        grid[row][col] = 0; // Fri rute
      } else {
        grid[row][col] = numbers[numIdx];
        numIdx++;
      }
    }
  }

  return grid;
}

/**
 * Generer tom markeringsmatrise med fri rute allerede markert.
 */
export function createEmptyMarkedGrid(): MarkedGrid {
  const grid: MarkedGrid = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    grid[row] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      grid[row][col] = row === FREE_SPACE_ROW && col === FREE_SPACE_COL;
    }
  }
  return grid;
}

/**
 * Oppdater markeringsmatrise basert på trukne tall.
 */
export function markDrawnNumbers(
  numbers: CouponGrid,
  drawnNumbers: number[]
): MarkedGrid {
  const drawnSet = new Set(drawnNumbers);
  const marked = createEmptyMarkedGrid();

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (row === FREE_SPACE_ROW && col === FREE_SPACE_COL) continue;
      if (drawnSet.has(numbers[row][col])) {
        marked[row][col] = true;
      }
    }
  }

  return marked;
}

/** Velg `count` unike tilfeldige tall fra `min` til `max` (inklusiv). */
function pickRandom(min: number, max: number, count: number): number[] {
  const pool: number[] = [];
  for (let i = min; i <= max; i++) pool.push(i);

  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return result;
}
