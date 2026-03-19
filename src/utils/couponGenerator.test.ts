import { describe, it, expect } from 'vitest';
import { generateCouponNumbers, createEmptyMarkedGrid, getCellValue } from './couponGenerator';
import { isValidCouponGrid } from './bingoValidator';
import { FREE_CELL_INDEX, GRID_SIZE } from './constants';

describe('generateCouponNumbers', () => {
  it('returns a flat array of 25 elements', () => {
    const grid = generateCouponNumbers();
    expect(grid).toHaveLength(25);
  });

  it('has 0 (free space) at center index 12', () => {
    const grid = generateCouponNumbers();
    expect(grid[FREE_CELL_INDEX]).toBe(0);
  });

  it('has correct number ranges per column', () => {
    const grid = generateCouponNumbers();
    for (let col = 0; col < GRID_SIZE; col++) {
      const min = col * 15 + 1;
      const max = (col + 1) * 15;
      for (let row = 0; row < GRID_SIZE; row++) {
        const val = getCellValue(grid, row, col);
        if (row === 2 && col === 2) {
          expect(val).toBe(0); // free space
        } else {
          expect(val).toBeGreaterThanOrEqual(min);
          expect(val).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('has unique numbers within each column', () => {
    const grid = generateCouponNumbers();
    for (let col = 0; col < GRID_SIZE; col++) {
      const values: number[] = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        const val = getCellValue(grid, row, col);
        if (val !== 0) values.push(val);
      }
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('passes isValidCouponGrid validation', () => {
    for (let i = 0; i < 20; i++) {
      const grid = generateCouponNumbers();
      expect(isValidCouponGrid(grid)).toBe(true);
    }
  });

  it('generates different coupons on successive calls', () => {
    const a = generateCouponNumbers();
    const b = generateCouponNumbers();
    // Extremely unlikely to be identical
    const same = a.every((val, i) => val === b[i]);
    expect(same).toBe(false);
  });
});

describe('createEmptyMarkedGrid', () => {
  it('returns a flat array of 25 booleans', () => {
    const grid = createEmptyMarkedGrid();
    expect(grid).toHaveLength(25);
    grid.forEach((val) => expect(typeof val).toBe('boolean'));
  });

  it('has center cell marked as true', () => {
    const grid = createEmptyMarkedGrid();
    expect(grid[FREE_CELL_INDEX]).toBe(true);
  });

  it('has all other cells as false', () => {
    const grid = createEmptyMarkedGrid();
    grid.forEach((val, i) => {
      if (i !== FREE_CELL_INDEX) expect(val).toBe(false);
    });
  });
});
