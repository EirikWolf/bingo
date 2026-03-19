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
      className="rounded-2xl bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 p-6 text-center shadow-xl"
    >
      <motion.h2
        className="text-4xl lg:text-6xl font-extrabold text-yellow-900"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        BINGO!
      </motion.h2>
      <div className="mt-4 space-y-2">
        {winners.map((w, i) => (
          <div key={i} className="text-xl font-semibold text-yellow-800">
            {w.displayName} — {WIN_CONDITION_LABELS[w.winCondition]}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
