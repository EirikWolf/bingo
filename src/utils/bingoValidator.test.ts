import { describe, it, expect } from 'vitest';
import { checkWinCondition, isValidCouponGrid, countRemainingForWin, findWinCondition } from './bingoValidator';
import { GRID_SIZE, FREE_CELL_INDEX } from './constants';

// Helper: create a known grid for testing
// Row-major flat array, col ranges: B(1-15), I(16-30), N(31-45), G(46-60), O(61-75)
function makeTestGrid(): number[] {
  return [
    // row 0: B=1,  I=16, N=31, G=46, O=61
    1, 16, 31, 46, 61,
    // row 1: B=2,  I=17, N=32, G=47, O=62
    2, 17, 32, 47, 62,
    // row 2: B=3,  I=18, N=0,  G=48, O=63
    3, 18, 0, 48, 63,
    // row 3: B=4,  I=19, N=33, G=49, O=64
    4, 19, 33, 49, 64,
    // row 4: B=5,  I=20, N=34, G=50, O=65
    5, 20, 34, 50, 65,
  ];
}

describe('checkWinCondition', () => {
  const grid = makeTestGrid();

  it('detects a complete row', () => {
    const drawn = new Set([1, 16, 31, 46, 61]);
    expect(checkWinCondition(grid, drawn, 'row')).toBe(true);
  });

  it('detects a complete column', () => {
    const drawn = new Set([1, 2, 3, 4, 5]);
    expect(checkWinCondition(grid, drawn, 'column')).toBe(true);
  });

  it('detects a complete diagonal (top-left to bottom-right)', () => {
    const drawn = new Set([1, 17, 49, 65]);
    expect(checkWinCondition(grid, drawn, 'diagonal')).toBe(true);
  });

  it('detects a complete diagonal (top-right to bottom-left)', () => {
    const drawn = new Set([61, 47, 19, 5]);
    expect(checkWinCondition(grid, drawn, 'diagonal')).toBe(true);
  });

  it('detects full board', () => {
    const allNums = grid.filter(n => n !== 0);
    const drawn = new Set(allNums);
    expect(checkWinCondition(grid, drawn, 'full_board')).toBe(true);
  });

  it('returns false when incomplete', () => {
    const drawn = new Set([1, 16, 31, 46]);
    expect(checkWinCondition(grid, drawn, 'row')).toBe(false);
  });

  it('free space counts for row 2', () => {
    const drawn = new Set([3, 18, 48, 63]);
    expect(checkWinCondition(grid, drawn, 'row')).toBe(true);
  });
});

describe('findWinCondition', () => {
  const grid = makeTestGrid();

  it('returns first matching condition', () => {
    const drawn = new Set([1, 16, 31, 46, 61]);
    const result = findWinCondition(grid, drawn, ['row', 'column', 'diagonal']);
    expect(result).toBe('row');
  });

  it('returns null when no condition is met', () => {
    const drawn = new Set([1, 16]);
    const result = findWinCondition(grid, drawn, ['row', 'column', 'diagonal']);
    expect(result).toBeNull();
  });
});

describe('countRemainingForWin', () => {
  const grid = makeTestGrid();

  it('returns 0 when a condition is met', () => {
    const drawn = new Set([1, 16, 31, 46, 61]);
    expect(countRemainingForWin(grid, drawn, ['row'])).toBe(0);
  });

  it('returns correct remaining count', () => {
    // Row 0 needs 1, 16, 31, 46, 61 — provide 3 of 5
    const drawn = new Set([1, 16, 31]);
    // Best row: row 0 needs 2 more (46, 61)
    const remaining = countRemainingForWin(grid, drawn, ['row']);
    expect(remaining).toBe(2);
  });
});

describe('isValidCouponGrid', () => {
  it('validates a correct grid', () => {
    expect(isValidCouponGrid(makeTestGrid())).toBe(true);
  });

  it('rejects grid with wrong length', () => {
    expect(isValidCouponGrid([1, 2, 3])).toBe(false);
  });

  it('rejects grid with non-zero free cell', () => {
    const grid = makeTestGrid();
    grid[FREE_CELL_INDEX] = 35;
    expect(isValidCouponGrid(grid)).toBe(false);
  });

  it('rejects grid with out-of-range number', () => {
    const grid = makeTestGrid();
    grid[0] = 20; // B column should be 1-15
    expect(isValidCouponGrid(grid)).toBe(false);
  });

  it('rejects grid with duplicate in column', () => {
    const grid = makeTestGrid();
    grid[0] = grid[GRID_SIZE]!; // Make row 0, col 0 same as row 1, col 0
    expect(isValidCouponGrid(grid)).toBe(false);
  });
});
