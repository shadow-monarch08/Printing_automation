import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface ToastConfig {
  id?: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  duration?: number;
  dismissible?: boolean;
}

interface ToastContextValue {
  addToast: (config: ToastConfig) => string;
  dismissToast: (id: string) => void;
  clearAll: () => void;
  toasts: ToastConfig[];
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  const addToast = useCallback((config: ToastConfig) => {
    const id = config.id || crypto.randomUUID();
    setToasts((prev) => {
      const newToasts = [{ ...config, id }, ...prev];
      if (newToasts.length > 5) {
        return newToasts.slice(0, 5); // Keep max 5 visible
      }
      return newToasts;
    });
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, dismissToast, clearAll, toasts }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
