export const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;

export const COLUMN_RANGES: Record<string, { min: number; max: number }> = {
  B: { min: 1, max: 15 },
  I: { min: 16, max: 30 },
  N: { min: 31, max: 45 },
  G: { min: 46, max: 60 },
  O: { min: 61, max: 75 },
};

export const BALL_COLORS: Record<string, string> = {
  B: 'bg-ball-b',
  I: 'bg-ball-i',
  N: 'bg-ball-n',
  G: 'bg-ball-g',
  O: 'bg-ball-o',
};

export function getColumnLetter(number: number): string {
  if (number >= 1 && number <= 15) return 'B';
  if (number >= 16 && number <= 30) return 'I';
  if (number >= 31 && number <= 45) return 'N';
  if (number >= 46 && number <= 60) return 'G';
  if (number >= 61 && number <= 75) return 'O';
  return '';
}

export function getBallColorClass(number: number): string {
  const letter = getColumnLetter(number);
  return BALL_COLORS[letter] ?? 'bg-gray-400';
}

export const WIN_CONDITION_LABELS: Record<string, string> = {
  row: 'Én rad',
  column: 'Én kolonne',
  diagonal: 'Diagonal',
  two_rows: 'To rader',
  full_board: 'Full plate',
  four_corners: 'Fire hjørner',
  cross: 'Kors',
};

export const GAME_STATUS_LABELS: Record<string, string> = {
  setup: 'Forberedes',
  open: 'Åpen for kjøp',
  active: 'Trekning pågår',
  paused: 'Pauset',
  finished: 'Avsluttet',
};
