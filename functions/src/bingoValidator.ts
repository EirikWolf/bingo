// Server-side bingo validator — authoritative copy
// Mirrors src/utils/bingoValidator.ts but runs in Cloud Functions

type WinCondition = 'row' | 'column' | 'diagonal' | 'full_board';

const GRID_SIZE = 5;
const FREE_CELL_INDEX = 12;

function computeEffectiveMarks(numbers: number[], drawnNumbers: Set<number>): boolean[] {
  return numbers.map((num, index) => {
    if (index === FREE_CELL_INDEX) return true;
    return drawnNumbers.has(num);
  });
}

function checkRows(marks: boolean[]): boolean {
  for (let row = 0; row < GRID_SIZE; row++) {
    let complete = true;
    for (let col = 0; col < GRID_SIZE; col++) {
      if (!marks[row * GRID_SIZE + col]) { complete = false; break; }
    }
    if (complete) return true;
  }
  return false;
}

function checkColumns(marks: boolean[]): boolean {
  for (let col = 0; col < GRID_SIZE; col++) {
    let complete = true;
    for (let row = 0; row < GRID_SIZE; row++) {
      if (!marks[row * GRID_SIZE + col]) { complete = false; break; }
    }
    if (complete) return true;
  }
  return false;
}

function checkDiagonals(marks: boolean[]): boolean {
  let diag1 = true;
  for (let i = 0; i < GRID_SIZE; i++) {
    if (!marks[i * GRID_SIZE + i]) { diag1 = false; break; }
  }
  if (diag1) return true;

  let diag2 = true;
  for (let i = 0; i < GRID_SIZE; i++) {
    if (!marks[i * GRID_SIZE + (GRID_SIZE - 1 - i)]) { diag2 = false; break; }
  }
  return diag2;
}

function checkFullBoard(marks: boolean[]): boolean {
  return marks.every(Boolean);
}

export function checkWinCondition(
  numbers: number[],
  drawnNumbers: Set<number>,
  condition: WinCondition
): boolean {
  const effective = computeEffectiveMarks(numbers, drawnNumbers);
  switch (condition) {
    case 'row': return checkRows(effective);
    case 'column': return checkColumns(effective);
    case 'diagonal': return checkDiagonals(effective);
    case 'full_board': return checkFullBoard(effective);
  }
}

export function findWinCondition(
  numbers: number[],
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
