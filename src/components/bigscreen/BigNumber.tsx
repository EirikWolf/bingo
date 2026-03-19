import { motion, AnimatePresence } from 'framer-motion';
import { getBallColor, getLetterForNumber } from '@/utils/constants';

interface BigNumberProps {
  number: number | null;
}

export function BigNumber({ number }: BigNumberProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <AnimatePresence mode="wait">
        {number ? (
          <motion.div
            key={number}
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className={`big-number ${getBallColor(number)}`}
          >
            <div className="flex flex-col items-center leading-none">
              <span className="text-2xl font-medium opacity-80">{getLetterForNumber(number)}</span>
              <span>{number}</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="big-number bg-gray-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="text-4xl text-gray-400">?</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
