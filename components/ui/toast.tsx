'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from '@phosphor-icons/react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const toastConfig: Record<ToastType, { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>; color: string; bg: string; border: string }> = {
  success: { icon: CheckCircle, color: '#22c55e', bg: '#22c55e/10', border: '#22c55e/20' },
  error: { icon: XCircle, color: '#ef4444', bg: '#ef4444/10', border: '#ef4444/20' },
  info: { icon: Info, color: '#00c4ff', bg: '#00c4ff/10', border: '#00c4ff/20' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast Container */}
      <div
        role="region"
        aria-label="Notifications"
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end"
      >
        <AnimatePresence>
          {toasts.map(t => {
            const { icon: Icon, color, border } = toastConfig[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3 px-4 py-3 rounded-[8px] min-w-[280px] max-w-[400px]"
                style={{
                  background: '#0f0f12',
                  border: `1px solid ${border.replace('/', '').replace('10', '').replace('20', '')}33`,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
              >
                <Icon size={18} style={{ color, flexShrink: 0 }} />
                <p className="text-sm text-[#fafafa] flex-1">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-[#4a4a5e] hover:text-[#8b8b9e] transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue['toast'] {
  return useContext(ToastContext).toast;
}
