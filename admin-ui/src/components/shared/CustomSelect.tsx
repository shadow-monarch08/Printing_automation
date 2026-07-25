// src/components/shared/CustomSelect.tsx
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { soundFx } from '../../utils/sound';

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
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    soundFx.playClick();
    setIsOpen(!isOpen);
  };

  const handleSelectOption = (option: Option) => {
    if (option.disabled) return;
    soundFx.playClick();
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <div className="custom-select-container" ref={containerRef}>
      {label && <label className="custom-select-label">{label}</label>}
      <div 
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={handleToggle}
        tabIndex={0}
      >
        <span className="custom-select-value">{selectedOption.label}</span>
        <ChevronDown size={18} className="custom-select-icon" />
      </div>
      
      {isOpen && (
        <div className="custom-select-dropdown">
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
