import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '../../context/ModalContext';
import { X } from 'lucide-react';

export function Modal() {
  const { isOpen, closeModal, modalConfig } = useModal();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, closeModal]);

  if (!isOpen && !modalConfig) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && modalConfig?.closeOnBackdropClick !== false) {
      closeModal();
    }
  };

  const isEntering = isOpen;

  return createPortal(
    <div className={`modal-wrapper ${isEntering ? 'modal--entering' : 'modal--exiting'}`}>
      <div 
        className={`modal-backdrop ${modalConfig?.hideBackdrop ? 'modal-backdrop--hidden' : ''} ${modalConfig?.position === 'bottom' ? 'modal-backdrop--bottom' : ''}`} 
        onClick={handleBackdropClick}
      >
        <div className={`modal-container ${modalConfig?.size || 'md'}`} role="dialog" aria-modal="true">
          <div className="modal-header">
            <h2>{modalConfig?.title}</h2>
            {modalConfig?.showCloseButton !== false && (
              <button className="modal-close" onClick={closeModal} aria-label="Close modal">
                <X size={20} />
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
