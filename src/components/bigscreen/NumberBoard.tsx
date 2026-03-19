import { useMemo } from 'react';
import { BINGO_LETTERS, COLUMN_RANGES, getBallColor } from '@/utils/constants';

interface NumberBoardProps {
  drawnNumbers: Set<number>;
}

export function NumberBoard({ drawnNumbers }: NumberBoardProps) {
  // Build grid: 5 columns, 15 rows each
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
    <div className="grid grid-cols-5 gap-1 sm:gap-2">
      {/* Column headers */}
      {BINGO_LETTERS.map((letter, col) => (
        <div
          key={letter}
          className={`flex items-center justify-center rounded-t-lg py-2 text-xl font-bold text-white ${getBallColor(COLUMN_RANGES[col]!.min)}`}
        >
          {letter}
        </div>
      ))}

      {/* Number cells - iterate by row then column for correct grid layout */}
      {Array.from({ length: 15 }, (_, row) =>
        columns.map(({ nums }) => {
          const num = nums[row]!;
          const isDrawn = drawnNumbers.has(num);
          return (
            <div
              key={num}
              className={`flex items-center justify-center rounded py-1.5 text-sm lg:text-lg lg:py-2.5 font-semibold transition-all duration-300 ${
                isDrawn
                  ? `${getBallColor(num)} text-white shadow-md scale-105`
                  : 'bg-gray-700/50 text-gray-400'
              }`}
            >
              {num}
            </div>
          );
        })
      )}
    </div>
  );
}
