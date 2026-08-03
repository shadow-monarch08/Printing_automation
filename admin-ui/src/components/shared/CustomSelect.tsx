// src/components/shared/CustomSelect.tsx
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { soundFx } from '../../utils/sound';
import { useModal } from '../../context/ModalContext';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function CustomSelect({ options, value, onChange, label }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);
  const containerRef = useRef<HTMLDivElement>(null);
  const { openModal, closeModal } = useModal();

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectOption = (option: Option, isMobileModal: boolean = false) => {
    if (option.disabled) return;
    soundFx.playClick();
    onChange(option.value);
    setIsOpen(false);
    if (isMobileModal) {
      closeModal();
    }
  };

  const openMobileModal = () => {
    openModal({
      title: label ? `SELECT: [${label.toUpperCase()}]` : 'SELECT_OPTION',
      size: 'sm',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto', padding: '4px' }}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                onClick={() => handleSelectOption(option, true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: isSelected ? 'rgba(255, 107, 0, 0.08)' : 'var(--bg-surface)',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: option.disabled ? 'not-allowed' : 'pointer',
                  opacity: option.disabled ? 0.5 : 1,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={18} style={{ color: 'var(--accent-primary)' }} />}
              </div>
            );
          })}
        </div>
      ),
    });
  };

  const handleToggle = () => {
    soundFx.playClick();
    if (isMobile) {
      openMobileModal();
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="custom-select-container" ref={containerRef}>
      {label && <label className="custom-select-label">{label}</label>}
      <div 
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={handleToggle}
        tabIndex={0}
      >
        <span className="custom-select-value">{selectedOption ? selectedOption.label : ''}</span>
        <ChevronDown size={18} className="custom-select-icon" />
      </div>
      
      {!isMobile && isOpen && (
        <div className="custom-select-dropdown" style={{ maxHeight: '260px', overflowY: 'auto' }}>
          {options.map((option) => (
            <div 
              key={option.value}
              className={`custom-select-option ${option.value === value ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}`}
              onClick={() => handleSelectOption(option)}
              style={option.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={16} className="check-icon" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
