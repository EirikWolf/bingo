import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { CouponGrid as CouponGridType, MarkedGrid } from '@/types';
import { GRID_SIZE, FREE_CELL_INDEX } from '@/utils/constants';
import { BINGO_LETTERS } from '@/utils/constants';

interface CouponGridProps {
  numbers: CouponGridType;
  markedCells: MarkedGrid;
  drawnNumbers: Set<number>;
  autoMark?: boolean;
  onToggleMark?: (cellIndex: number, marked: boolean) => void;
  className?: string;
}

export function CouponGrid({
  numbers,
  markedCells,
  drawnNumbers,
  autoMark = true,
  onToggleMark,
  className = '',
}: CouponGridProps) {
  // Effective marks shown in the UI:
  //  - auto: drawn ∩ numbers (+ free space)
  //  - manual: only player-marked cells whose number has been drawn (+ free space)
  const effectiveMarks = useMemo(() => {
    return numbers.map((num, index) => {
      if (index === FREE_CELL_INDEX) return true;
      if (autoMark) return drawnNumbers.has(num);
      return (markedCells[index] ?? false) && drawnNumbers.has(num);
    });
  }, [numbers, drawnNumbers, markedCells, autoMark]);

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
            const isDrawn = drawnNumbers.has(num);
            const isInteractive = !autoMark && !isFreeCell && !!onToggleMark;

            return (
              <CouponCell
                key={index}
                number={num}
                isMarked={isMarked}
                isFreeCell={isFreeCell}
                isNewlyMarked={isNewlyMarked}
                isDrawn={isDrawn}
                isInteractive={isInteractive}
                onClick={isInteractive ? () => onToggleMark!(index, !isMarked) : undefined}
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
  isDrawn: boolean;
  isInteractive: boolean;
  onClick?: () => void;
}

function CouponCell({ number, isMarked, isFreeCell, isNewlyMarked, isDrawn, isInteractive, onClick }: CouponCellProps) {
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
    const cell = (
      <motion.div
        className={`${baseClasses} bingo-cell-marked ${isNewlyMarked ? 'bingo-cell-glow' : ''} ${isInteractive ? 'cursor-pointer' : ''}`}
        initial={isNewlyMarked ? { scale: 0.8 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        aria-label={`${number}, markert`}
        onClick={onClick}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onKeyDown={
          isInteractive && onClick
            ? e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        {number}
      </motion.div>
    );
    return cell;
  }

  // Unmarked. In manual mode show a hint if the number has been drawn.
  const hintClass = isInteractive && isDrawn ? 'bingo-cell-drawn-hint' : '';
  const interactiveClass = isInteractive ? 'cursor-pointer' : '';

  return (
    <div
      className={`${baseClasses} bingo-cell-unmarked ${hintClass} ${interactiveClass}`}
      aria-label={isDrawn ? `${number}, trukket` : `${number}`}
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive && onClick
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {number}
    </div>
  );
}

function getHeaderColor(col: number): string {
  const colors = ['bg-ball-b', 'bg-ball-i', 'bg-ball-n', 'bg-ball-g', 'bg-ball-o'];
  return colors[col] ?? 'bg-gray-400';
}
