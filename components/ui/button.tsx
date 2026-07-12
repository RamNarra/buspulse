'use client';
import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { SpinnerGap } from '@phosphor-icons/react';
import { clsx } from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#00c4ff] text-[#0a0a0b] font-semibold hover:bg-[#00b3eb] border border-transparent',
  secondary: 'bg-[#1a1a1f] text-[#fafafa] border border-[#252532] hover:bg-[#232328] hover:border-[#2e2e3e]',
  ghost: 'bg-transparent text-[#8b8b9e] hover:bg-[#1a1a1f] hover:text-[#fafafa] border border-transparent',
  danger: 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 hover:bg-[#ef4444]/20',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

/**
 * Button — wraps a native <button> in a motion.div for tap animations
 * to avoid the onDrag type conflict between React's DragEventHandler
 * and Framer Motion's PanInfo-based drag handlers.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', isLoading, leftIcon, children, className, disabled, style, ...props },
  ref
) {
  return (
    <motion.div
      whileTap={{ scale: disabled || isLoading ? 1 : 0.97 }}
      transition={{ duration: 0.1 }}
      style={{ display: 'inline-flex', ...style }}
    >
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          'inline-flex items-center justify-center rounded-[8px] font-medium',
          'transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus-visible:outline-2 focus-visible:outline-[#00c4ff] focus-visible:outline-offset-2',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <SpinnerGap size={size === 'sm' ? 14 : 16} className="animate-spin" />
        ) : leftIcon}
        {children}
      </button>
    </motion.div>
  );
});
