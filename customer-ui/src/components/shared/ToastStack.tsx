import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';
import type { ToastConfig } from '../../context/ToastContext';
import { X } from 'lucide-react';
import { soundFx } from '../../utils/sound';

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
    soundFx.playClick();
    setIsExiting(true);
    setTimeout(() => {
      dismissToast(toast.id!);
    }, 300);
  };

  const statusTags = {
    success: '[OK_STATUS]',
    error: '[SYS_ERROR]',
    warning: '[WARN_ALERT]',
    info: '[INFO_LOG]',
  };

  const statusColors = {
    success: 'var(--status-idle)',
    error: 'var(--status-error)',
    warning: 'var(--status-busy)',
    info: 'var(--accent-secondary)',
  };

  return (
    <div className={`toast dotmatrix-toast toast--${toast.type} ${isExiting ? 'toast-exiting' : 'toast-entering'}`} role="alert">
      <div className="toast-container-inner" style={{ padding: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span 
              className="pulse-led"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '1px',
                backgroundColor: statusColors[toast.type],
                display: 'inline-block',
                boxShadow: `0 0 6px ${statusColors[toast.type]}`,
                flexShrink: 0
              }} 
            />
            <span 
              style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '11px', 
                fontWeight: 700, 
                letterSpacing: '0.05em', 
                color: statusColors[toast.type] 
              }}
            >
              {statusTags[toast.type]}
            </span>
            <span 
              className="toast-title"
              style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '12px', 
                fontWeight: 600, 
                color: 'var(--text-primary)',
                marginLeft: '4px'
              }}
            >
              {toast.title}
            </span>
          </div>

          {toast.description && (
            <div 
              className="toast-description"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                lineHeight: 1.4,
                color: 'var(--text-secondary)',
                paddingLeft: '14px',
              }}
            >
              {toast.description}
            </div>
          )}
        </div>

        {toast.dismissible !== false && (
          <button 
            className="toast-dismiss" 
            onClick={handleDismiss} 
            aria-label="Dismiss"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '2px'
            }}
          >
            <X size={14} />
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
