import { useMemo } from 'react';
import { BINGO_LETTERS, COLUMN_RANGES, getBallColor } from '@/utils/constants';

interface NumberBoardProps {
  drawnNumbers: Set<number>;
  currentNumber?: number | null;
}

const BALL_HEX: Record<number, string> = {
  0: '#ef4444', 1: '#d97706', 2: '#16a34a', 3: '#3b82f6', 4: '#8b5cf6',
};

export function NumberBoard({ drawnNumbers, currentNumber }: NumberBoardProps) {
  const columns = useMemo(() => {
    return BINGO_LETTERS.map((letter, col) => {
      const { min, max } = COLUMN_RANGES[col]!;
      const nums: number[] = [];
      for (let n = min; n <= max; n++) {
        nums.push(n);
      }
      return { letter, nums, col };
    });
  }, []);

  return (
    <div
      className="w-full h-full gap-[2px]"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gridTemplateRows: 'auto repeat(15, 1fr)',
      }}
    >
      {/* Column headers */}
      {BINGO_LETTERS.map((letter, col) => (
        <div
          key={letter}
          className={`flex items-center justify-center py-1 text-sm font-extrabold tracking-wider text-white rounded-t ${getBallColor(COLUMN_RANGES[col]!.min)}`}
        >
          {letter}
        </div>
      ))}

      {/* Number cells */}
      {Array.from({ length: 15 }, (_, row) =>
        columns.map(({ nums, col }) => {
          const num = nums[row]!;
          const isDrawn = drawnNumbers.has(num);
          const isCurrent = num === currentNumber;
          const hex = BALL_HEX[col] ?? '#3b82f6';

          return (
            <div
              key={num}
              className={`flex items-center justify-center text-xs font-bold ${
                isDrawn
                  ? `board-cell-drawn ${getBallColor(num)} ${isCurrent ? 'ring-1 ring-white/50 scale-110 z-10' : ''}`
                  : 'board-cell-undrawn'
              }`}
              style={isDrawn ? {
                '--cell-glow-color': `${hex}4D`,
              } as React.CSSProperties : undefined}
            >
              {num}
            </div>
          );
        })
      )}
    </div>
  );
}
