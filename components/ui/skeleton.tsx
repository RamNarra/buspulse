import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'block' | 'circle';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = 'block', width, height }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'skeleton',
        variant === 'circle' && 'rounded-full',
        variant === 'text' && 'h-4 rounded-[4px]',
        variant === 'block' && 'rounded-[6px]',
        className,
      )}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '65%' : '100%'}
        />
      ))}
    </div>
  );
}
