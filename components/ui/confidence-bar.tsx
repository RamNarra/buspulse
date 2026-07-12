'use client';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { confidenceLabel } from '@/lib/live/eta';

interface ConfidenceBarProps {
  confidence: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  showPercentage?: boolean;
}

function getBarColor(confidence: number): string {
  if (confidence >= 0.75) return '#22c55e';
  if (confidence >= 0.45) return '#f59e0b';
  return '#ef4444';
}

export function ConfidenceBar({
  confidence,
  size = 'md',
  showLabel = true,
  showPercentage = true,
}: ConfidenceBarProps) {
  const pct = Math.round(confidence * 100);
  const color = getBarColor(confidence);
  const label = confidenceLabel(confidence);

  return (
    <div className="flex flex-col gap-1.5">
      {(showLabel || showPercentage) && (
        <div className="flex items-center justify-between">
          {showLabel && (
            <span className="text-xs text-[#8b8b9e] font-medium">Signal</span>
          )}
          {showPercentage && (
            <span className="text-xs font-mono" style={{ color }}>
              {pct}% · {label}
            </span>
          )}
        </div>
      )}
      <div
        className={clsx(
          'relative rounded-full bg-[#1a1a1f] overflow-hidden',
          size === 'sm' ? 'h-1' : 'h-1.5',
        )}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
