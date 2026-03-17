import { GRID_SIZE } from '@/types';
import type { MarkedGrid, WinCondition } from '@/types';

/**
 * Sjekk om en kupong har oppnådd en gevinstbetingelse.
 *
 * Brukes på klientsiden for å vise "nesten Bingo"-indikatorer
 * og aktivere Bingo-knappen. Autoritativ validering skjer i Cloud Function.
 */
export function checkWinConditions(
  marked: MarkedGrid,
  activeConditions: WinCondition[]
): WinCondition | null {
  for (const condition of activeConditions) {
    if (checkCondition(marked, condition)) {
      return condition;
    }
  }
  return null;
}

/** Tell antall gjenstående markerte celler for nærmeste gevinst. */
export function countRemainingForWin(
  marked: MarkedGrid,
  activeConditions: WinCondition[]
): number {
  let minRemaining = Infinity;

  for (const condition of activeConditions) {
    const remaining = getRemainingCount(marked, condition);
    if (remaining < minRemaining) {
      minRemaining = remaining;
    }
  }

  return minRemaining === Infinity ? GRID_SIZE : minRemaining;
}

function checkCondition(marked: MarkedGrid, condition: WinCondition): boolean {
  switch (condition) {
    case 'row':
      return checkRows(marked) >= 1;
    case 'column':
      return checkColumns(marked) >= 1;
    case 'diagonal':
      return checkDiagonals(marked);
    case 'two_rows':
      return checkRows(marked) >= 2;
    case 'full_board':
      return checkFullBoard(marked);
    case 'four_corners':
      return checkFourCorners(marked);
    case 'cross':
      return checkCross(marked);
    default:
      return false;
  }
}

function checkRows(marked: MarkedGrid): number {
  let count = 0;
  for (let row = 0; row < GRID_SIZE; row++) {
    if (marked[row].every((cell) => cell)) count++;
  }
  return count;
}

function checkColumns(marked: MarkedGrid): number {
  let count = 0;
  for (let col = 0; col < GRID_SIZE; col++) {
    let allMarked = true;
    for (let row = 0; row < GRID_SIZE; row++) {
      if (!marked[row][col]) { allMarked = false; break; }
    }
    if (allMarked) count++;
  }
  return count;
}

function checkDiagonals(marked: MarkedGrid): boolean {
  const diag1 = Array.from({ length: GRID_SIZE }, (_, i) => marked[i][i]).every(Boolean);
  const diag2 = Array.from({ length: GRID_SIZE }, (_, i) => marked[i][GRID_SIZE - 1 - i]).every(Boolean);
  return diag1 || diag2;
}

function checkFullBoard(marked: MarkedGrid): boolean {
  return marked.every((row) => row.every((cell) => cell));
}

function checkFourCorners(marked: MarkedGrid): boolean {
  return (
    marked[0][0] &&
    marked[0][GRID_SIZE - 1] &&
    marked[GRID_SIZE - 1][0] &&
    marked[GRID_SIZE - 1][GRID_SIZE - 1]
  );
}

function checkCross(marked: MarkedGrid): boolean {
  const mid = Math.floor(GRID_SIZE / 2);
  const midRow = marked[mid].every((cell) => cell);
  const midCol = Array.from({ length: GRID_SIZE }, (_, i) => marked[i][mid]).every(Boolean);
  return midRow && midCol;
}

function getRemainingCount(marked: MarkedGrid, condition: WinCondition): number {
  switch (condition) {
    case 'row':
      return Math.min(...Array.from({ length: GRID_SIZE }, (_, row) =>
        marked[row].filter((c) => !c).length
      ));
    case 'column':
      return Math.min(...Array.from({ length: GRID_SIZE }, (_, col) => {
        let unmarked = 0;
        for (let row = 0; row < GRID_SIZE; row++) {
          if (!marked[row][col]) unmarked++;
        }
        return unmarked;
      }));
    case 'diagonal': {
      const d1 = Array.from({ length: GRID_SIZE }, (_, i) => marked[i][i]).filter((c) => !c).length;
      const d2 = Array.from({ length: GRID_SIZE }, (_, i) => marked[i][GRID_SIZE - 1 - i]).filter((c) => !c).length;
      return Math.min(d1, d2);
    }
    case 'full_board':
      return marked.flat().filter((c) => !c).length;
    case 'four_corners': {
      let count = 0;
      if (!marked[0][0]) count++;
      if (!marked[0][GRID_SIZE - 1]) count++;
      if (!marked[GRID_SIZE - 1][0]) count++;
      if (!marked[GRID_SIZE - 1][GRID_SIZE - 1]) count++;
      return count;
    }
    default:
      return GRID_SIZE;
  }
}
