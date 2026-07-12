'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { confidenceLabel } from '@/lib/live/eta';

interface EtaDisplayProps {
  etaMinutes: number | null;
  confidence: number | null;
  lastUpdatedAt: number | null;
  stale?: boolean;
  className?: string;
}

function useTimeAgo(timestamp: number | null): string {
  const [label, setLabel] = useState<string>('—');
  useEffect(() => {
    const update = () => {
      if (!timestamp) { setLabel('—'); return; }
      const diff = Math.floor((Date.now() - timestamp) / 1000);
      if (diff < 5) setLabel('just now');
      else if (diff < 60) setLabel(`${diff}s ago`);
      else setLabel(`${Math.floor(diff / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timestamp]);
  return label;
}

export function EtaDisplay({ etaMinutes, confidence, lastUpdatedAt, stale, className }: EtaDisplayProps) {
  const timeAgo = useTimeAgo(lastUpdatedAt);
  const confLabel = confidence != null ? confidenceLabel(confidence) : null;

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {/* ETA Number */}
      <div className="flex items-end gap-2">
        <AnimatePresence mode="wait">
          <motion.span
            key={etaMinutes ?? 'null'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              'text-4xl font-bold tracking-tight leading-none',
              stale ? 'text-[#4a4a5e]' : 'text-[#00c4ff]',
            )}
          >
            {etaMinutes ?? '—'}
          </motion.span>
        </AnimatePresence>
        <span className="text-base text-[#8b8b9e] font-medium pb-0.5">min</span>
        {confLabel && !stale && (
          <span className="text-xs font-mono text-[#00c4ff]/70 pb-0.5 ml-1">
            · {confLabel}
          </span>
        )}
      </div>

      {/* Metadata */}
      <p className="text-xs text-[#4a4a5e] font-mono">
        {stale ? 'Signal lost' : `Updated ${timeAgo}`}
      </p>
    </div>
  );
}
