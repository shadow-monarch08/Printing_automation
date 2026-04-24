import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface ModalConfig {
  title: string;
  size?: 'sm' | 'md' | 'lg';
  content: ReactNode;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  footer?: ReactNode;
  onClose?: () => void;
}

interface ModalContextValue {
  openModal: (config: ModalConfig) => void;
  closeModal: () => void;
  isOpen: boolean;
  modalConfig: ModalConfig | null;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

  const openModal = (config: ModalConfig) => {
    setModalConfig(config);
    setIsOpen(true);
  };

  const closeModal = () => {
    if (modalConfig?.onClose) {
      modalConfig.onClose();
    }
    setIsOpen(false);
    setTimeout(() => {
        setModalConfig(null);
    }, 200); // match transition exit
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal, isOpen, modalConfig }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
