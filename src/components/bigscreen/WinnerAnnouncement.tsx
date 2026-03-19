import { motion } from 'framer-motion';
import { WIN_CONDITION_LABELS } from '@/utils/constants';
import type { Winner } from '@/types';

interface WinnerAnnouncementProps {
  winners: Winner[];
}

export function WinnerAnnouncement({ winners }: WinnerAnnouncementProps) {
  if (winners.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 p-6 text-center shadow-xl winner-spotlight"
    >
      <motion.h2
        className="text-4xl lg:text-6xl font-extrabold text-yellow-900"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        BINGO!
      </motion.h2>
      <div className="mt-4 space-y-3">
        {winners.map((w, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.3 }}
            className="flex flex-col items-center"
          >
            {/* Avatar circle with initials */}
            <motion.div
              className="h-20 w-20 lg:h-28 lg:w-28 rounded-full bg-yellow-900/20 flex items-center justify-center mb-2"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2, delay: i * 0.5 }}
            >
              <span className="text-3xl lg:text-5xl font-extrabold text-yellow-900">
                {w.displayName.charAt(0).toUpperCase()}
              </span>
            </motion.div>
            <p className="text-xl lg:text-3xl font-semibold text-yellow-800">
              {w.displayName}
            </p>
            <p className="text-base lg:text-lg text-yellow-700">
              {WIN_CONDITION_LABELS[w.winCondition]}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
