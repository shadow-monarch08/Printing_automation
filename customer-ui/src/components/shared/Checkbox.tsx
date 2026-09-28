import React, { useId } from 'react';
import { Check } from 'lucide-react';
import { soundFx } from '../../utils/sound';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Checkbox({
  checked,
  onChange,
  disabled = false,
  label,
  children,
  className = '',
  style,
}: CheckboxProps) {
  const checkboxId = useId();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    soundFx.playClick();
    onChange(e.target.checked);
  };

  const content = label || children;

  return (
    <label
      htmlFor={checkboxId}
      className={`custom-checkbox-container ${disabled ? 'disabled' : ''} ${className}`}
      style={style}
    >
      <input
        id={checkboxId}
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="custom-checkbox-input"
      />
      <span className={`custom-checkbox-box ${checked ? 'checked' : ''}`}>
        <Check size={12} className={`custom-checkbox-tick ${checked ? 'visible' : ''}`} strokeWidth={3.5} />
      </span>
      {content && <span className="custom-checkbox-label">{content}</span>}
    </label>
  );
}
