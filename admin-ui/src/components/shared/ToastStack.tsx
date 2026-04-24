import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';
import type { ToastConfig } from '../../context/ToastContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

function ToastItem({ toast }: { toast: ToastConfig }) {
  const { dismissToast } = useToast();
  const [isExiting, setIsExiting] = useState(false);
  const duration = toast.duration === undefined ? 5000 : toast.duration;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      dismissToast(toast.id!);
    }, 300); // match exit transition
  };

  const icons = {
    success: <CheckCircle2 size={24} />,
    error: <AlertCircle size={24} />,
    info: <Info size={24} />,
    warning: <AlertTriangle size={24} />
  };

  return (
    <div className={`toast toast--${toast.type} ${isExiting ? 'toast-exiting' : 'toast-entering'}`} role="alert">
        <div className="toast-container-inner">
          <div className="toast-icon">
            {icons[toast.type]}
          </div>
          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            {toast.description && <div className="toast-description">{toast.description}</div>}
          </div>
          {toast.dismissible !== false && (
            <button className="toast-dismiss" onClick={handleDismiss} aria-label="Dismiss">
              <X size={16} />
            </button>
          )}
        </div>
      {duration > 0 && (
        <div 
          className="toast-progress toast-progress-anim" 
          style={{ animationDuration: `${duration}ms` }} 
        />
      )}
    </div>
  );
}

export function ToastStack() {
  const { toasts } = useToast();

  return createPortal(
    <div className="toast-stack">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body
  );
}
