import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { CouponGrid as CouponGridType, MarkedGrid } from '@/types';
import { GRID_SIZE, FREE_CELL_INDEX } from '@/utils/constants';
import { BINGO_LETTERS } from '@/utils/constants';

interface CouponGridProps {
  numbers: CouponGridType;
  markedCells: MarkedGrid;
  drawnNumbers: Set<number>;
  className?: string;
}

export function CouponGrid({ numbers, markedCells, drawnNumbers, className = '' }: CouponGridProps) {
  // Compute effective marks: cell is marked if its number has been drawn
  const effectiveMarks = useMemo(() => {
    return numbers.map((num, index) => {
      if (index === FREE_CELL_INDEX) return true;
      return drawnNumbers.has(num);
    });
  }, [numbers, drawnNumbers]);

  return (
    <div className={`select-none ${className}`}>
      {/* B-I-N-G-O Header */}
      <div className="grid grid-cols-5 gap-1 mb-1" aria-hidden="true">
        {BINGO_LETTERS.map((letter, col) => (
          <div
            key={letter}
            className={`flex items-center justify-center rounded-lg py-1.5 text-sm font-bold text-white ${getHeaderColor(col)}`}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="bingo-grid">
        {Array.from({ length: GRID_SIZE }, (_, row) =>
          Array.from({ length: GRID_SIZE }, (_, col) => {
            const index = row * GRID_SIZE + col;
            const num = numbers[index] ?? 0;
            const isMarked = effectiveMarks[index] ?? false;
            const isFreeCell = index === FREE_CELL_INDEX;
            const isNewlyMarked = !isFreeCell && isMarked && !(markedCells[index] ?? false);

            return (
              <CouponCell
                key={index}
                number={num}
                isMarked={isMarked}
                isFreeCell={isFreeCell}
                isNewlyMarked={isNewlyMarked}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

interface CouponCellProps {
  number: number;
  isMarked: boolean;
  isFreeCell: boolean;
  isNewlyMarked: boolean;
}

function CouponCell({ number, isMarked, isFreeCell, isNewlyMarked }: CouponCellProps) {
  const baseClasses = 'bingo-cell text-base sm:text-lg';

  if (isFreeCell) {
    return (
      <div
        className={`${baseClasses} ${isMarked ? 'bingo-cell-marked' : 'bingo-cell-free'}`}
        aria-label="Fri celle"
      >
        <span className="text-xs font-medium">FRI</span>
      </div>
    );
  }

  if (isMarked) {
    return (
      <motion.div
        className={`${baseClasses} bingo-cell-marked ${isNewlyMarked ? 'bingo-cell-glow' : ''}`}
        initial={isNewlyMarked ? { scale: 0.8 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        aria-label={`${number}, markert`}
      >
        {number}
      </motion.div>
    );
  }

  return (
    <div className={`${baseClasses} bingo-cell-unmarked`} aria-label={`${number}`}>
      {number}
    </div>
  );
}

function getHeaderColor(col: number): string {
  const colors = ['bg-ball-b', 'bg-ball-i', 'bg-ball-n', 'bg-ball-g', 'bg-ball-o'];
  return colors[col] ?? 'bg-gray-400';
}
