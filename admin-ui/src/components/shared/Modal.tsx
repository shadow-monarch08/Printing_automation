import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '../../context/ModalContext';
import { X } from 'lucide-react';
import { soundFx } from '../../utils/sound';

export function Modal() {
  const { isOpen, closeModal, modalConfig } = useModal();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundFx.playClick();
        closeModal();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, closeModal]);

  if (!isOpen && !modalConfig) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && modalConfig?.closeOnBackdropClick !== false) {
      soundFx.playClick();
      closeModal();
    }
  };

  const handleCloseClick = () => {
    soundFx.playClick();
    closeModal();
  };

  const isEntering = isOpen;

  const titleText = modalConfig?.title 
    ? (modalConfig.title.startsWith('[') ? modalConfig.title : `[SYS_PANEL] ${modalConfig.title}`)
    : '[SYS_PANEL]';

  return createPortal(
    <div className={`modal-wrapper ${isEntering ? 'modal--entering' : 'modal--exiting'}`}>
      <div 
        className={`modal-backdrop ${modalConfig?.hideBackdrop ? 'modal-backdrop--hidden' : ''} ${modalConfig?.position === 'bottom' ? 'modal-backdrop--bottom' : ''}`} 
        onClick={handleBackdropClick}
      >
        <div className={`modal-container industrial-modal-panel ${modalConfig?.size || 'md'}`} role="dialog" aria-modal="true">
          <div className="modal-header modal-panel-header">
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', margin: 0 }}>
              {titleText}
            </h2>
            {modalConfig?.showCloseButton !== false && (
              <button 
                className="modal-close" 
                onClick={handleCloseClick} 
                aria-label="Close modal"
                style={{
                  width: '28px',
                  height: '28px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--status-error)';
                  e.currentTarget.style.color = 'var(--status-error)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="modal-body">
            {modalConfig?.content}
          </div>
          {modalConfig?.footer && (
            <div className="modal-footer">
              {modalConfig.footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
