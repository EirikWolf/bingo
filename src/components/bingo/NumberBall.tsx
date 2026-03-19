import { motion } from 'framer-motion';
import { getBallColor, getLetterForNumber } from '@/utils/constants';

interface NumberBallProps {
  number: number;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-lg',
  lg: 'h-20 w-20 text-3xl',
};

export function NumberBall({ number, size = 'md', animate = false }: NumberBallProps) {
  const colorClass = getBallColor(number);
  const letter = getLetterForNumber(number);

  const ball = (
    <div className={`number-ball ${colorClass} ${sizeClasses[size]}`}>
      <div className="flex flex-col items-center leading-none">
        {size !== 'sm' && (
          <span className="text-[0.5em] font-medium opacity-80">{letter}</span>
        )}
        <span>{number}</span>
      </div>
    </div>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        {ball}
      </motion.div>
    );
  }

  return ball;
}
