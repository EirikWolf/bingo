import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

interface BingoButtonProps {
  enabled: boolean;
  loading?: boolean;
  onClick: () => void;
  remaining: number;
}

export function BingoButton({ enabled, loading = false, onClick, remaining }: BingoButtonProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        animate={enabled && !reducedMotion ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        <Button
          onClick={onClick}
          disabled={!enabled}
          loading={loading}
          size="lg"
          className={`w-full text-lg font-bold ${
            enabled
              ? `bg-green-600 hover:bg-green-700 focus:ring-green-500${reducedMotion ? '' : ' animate-pulse-glow'}`
              : ''
          }`}
        >
          BINGO!
        </Button>
      </motion.div>
      {!enabled && remaining > 0 && (
        <p className="text-xs text-gray-400">
          {remaining} {remaining === 1 ? 'tall' : 'tall'} igjen til naermeste gevinst
        </p>
      )}
    </div>
  );
}
