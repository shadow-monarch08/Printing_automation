import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

let globalAddToast: ((config: ToastConfig) => string) | null = null;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  const addToast = useCallback((config: ToastConfig) => {
    const id = config.id || generateUUID();
    setToasts((prev) => {
      const newToasts = [{ ...config, id }, ...prev];
      if (newToasts.length > 5) {
        return newToasts.slice(0, 5); // Keep max 5 visible
      }
      return newToasts;
    });
    return id;
  }, []);

  globalAddToast = addToast;

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

export const toast = {
  success: (title: string, description?: string) => {
    if (globalAddToast) {
      globalAddToast({ type: 'success', title, description });
    }
  },
  error: (title: string, description?: string) => {
    if (globalAddToast) {
      globalAddToast({ type: 'error', title, description });
    }
  },
  info: (title: string, description?: string) => {
    if (globalAddToast) {
      globalAddToast({ type: 'info', title, description });
    }
  },
  warning: (title: string, description?: string) => {
    if (globalAddToast) {
      globalAddToast({ type: 'warning', title, description });
    }
  }
};
