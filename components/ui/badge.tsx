import { clsx } from 'clsx';
import type { BusHealthStatus } from '@/types/models';

type BadgeVariant = 'filled' | 'outline';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'filled', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px]',
        'text-xs font-medium font-mono tracking-wide',
        variant === 'outline'
          ? 'border border-[#252532] text-[#8b8b9e] bg-transparent'
          : 'bg-[#1a1a1f] text-[#8b8b9e]',
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusConfig: Record<BusHealthStatus, { label: string; className: string; dotColor: string }> = {
  healthy: { label: 'Healthy', className: 'text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20', dotColor: '#22c55e' },
  degraded: { label: 'Degraded', className: 'text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20', dotColor: '#f59e0b' },
  stale: { label: 'Stale', className: 'text-[#6b7280] bg-[#6b7280]/10 border border-[#6b7280]/20', dotColor: '#6b7280' },
  offline: { label: 'Offline', className: 'text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20', dotColor: '#ef4444' },
  deviated: { label: 'Deviated', className: 'text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/20', dotColor: '#8b5cf6' },
  stranded: { label: 'Stranded', className: 'text-[#f97316] bg-[#f97316]/10 border border-[#f97316]/20', dotColor: '#f97316' },
  ghost: { label: 'Ghost', className: 'text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20', dotColor: '#ef4444' },
};

interface StatusBadgeProps {
  status: BusHealthStatus;
  showDot?: boolean;
}

export function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px]',
        'text-xs font-medium font-mono tracking-wide',
        config.className,
      )}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ backgroundColor: config.dotColor }}
        />
      )}
      {config.label}
    </span>
  );
}
