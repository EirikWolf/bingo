import { motion, AnimatePresence } from 'framer-motion';
import { getBallColor, getLetterForNumber } from '@/utils/constants';

interface BigNumberProps {
  number: number | null;
}

const BALL_HEX: Record<number, string> = {
  0: '#ef4444', 1: '#d97706', 2: '#16a34a', 3: '#3b82f6', 4: '#8b5cf6',
};

function getHexColor(num: number): string {
  return BALL_HEX[Math.floor((num - 1) / 15)] ?? '#3b82f6';
}

export function BigNumber({ number }: BigNumberProps) {
  const hex = number ? getHexColor(number) : '#334155';
  const letter = number ? getLetterForNumber(number) : '';

  return (
    <div className="sphere-machine">
      {/* Outer metallic ring with cross-hairs */}
      <div
        className="sphere-ring sphere-crosshair"
        style={{ '--sphere-glow': `${hex}55` } as React.CSSProperties}
      />

      {/* Inner glass ball */}
      <AnimatePresence mode="wait">
        {number ? (
          <motion.div
            key={number}
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className={`sphere-ball ${getBallColor(number)}`}
            style={{ '--sphere-glow': `${hex}44` } as React.CSSProperties}
          >
            <div className="flex flex-col items-center leading-none">
              <span className="font-semibold opacity-70" style={{ fontSize: 'clamp(1.2rem, 3vh, 2rem)' }}>
                {letter}
              </span>
              <span>{number}</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            className="sphere-ball bg-gray-700"
          >
            <span style={{ fontSize: 'clamp(2rem, 5vh, 4rem)' }} className="text-gray-500">?</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
