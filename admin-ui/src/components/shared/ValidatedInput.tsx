import React, { useState, useId } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { soundFx } from '../../utils/sound';

export interface ValidatedInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password' | 'email' | 'number';
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  sanitizeFn?: (val: string) => string;
  validateFn?: (val: string) => string | null;
  className?: string;
  addonLeft?: React.ReactNode;
  addonRight?: React.ReactNode;
  style?: React.CSSProperties;
}

export function ValidatedInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  name,
  sanitizeFn,
  validateFn,
  className = '',
  addonLeft,
  addonRight,
  style: propStyle,
}: ValidatedInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  const generatedId = useId();
  const inputId = name || generatedId;
  const errorId = `${inputId}-error`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    if (sanitizeFn) {
      newValue = sanitizeFn(newValue);
    }

    if (touched && error && validateFn) {
      const validationError = validateFn(newValue);
      if (!validationError) {
        setError(null);
      }
    }

    onChange(newValue);
  };

  const handleBlur = () => {
    setTouched(true);
    if (validateFn) {
      const validationError = validateFn(value);
      setError(validationError);
    }
  };

  const togglePassword = () => {
    soundFx.playClick();
    setShowPassword(!showPassword);
  };

  const isPasswordType = type === 'password';
  const resolvedType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`validated-input-container ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem', width: '100%', ...propStyle }}>
      {label && (
        <label 
          htmlFor={inputId} 
          className="stamped-label" 
          style={{ 
            display: 'block', 
            fontFamily: 'var(--font-mono)', 
            fontSize: '11px', 
            fontWeight: 600, 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em', 
            color: 'var(--text-secondary)' 
          }}
        >
          ▪ {label}
        </label>
      )}
      <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
        {addonLeft && (
          <span 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '0.5rem 0.75rem', 
              background: 'var(--bg-surface-alt)', 
              border: '1px solid var(--border-default)', 
              borderRight: 'none', 
              borderRadius: '2px 0 0 2px', 
              flexShrink: 0,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
            }}
          >
            {addonLeft}
          </span>
        )}
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'stretch' }}>
          <input
            id={inputId}
            name={name}
            type={resolvedType}
            className="input-field terminal-input"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={!!error}
            aria-errormessage={error ? errorId : undefined}
            style={{
              width: '100%',
              background: 'var(--bg-surface)',
              border: error ? '1px solid var(--status-error)' : '1px solid var(--border-default)',
              borderRadius: '2px',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              color: 'var(--text-primary)',
              padding: '0.5rem 0.75rem',
              paddingRight: isPasswordType ? '2.5rem' : '0.75rem',
              borderTopLeftRadius: addonLeft ? 0 : undefined,
              borderBottomLeftRadius: addonLeft ? 0 : undefined,
              borderTopRightRadius: addonRight ? 0 : undefined,
              borderBottomRightRadius: addonRight ? 0 : undefined,
            }}
          />
          {isPasswordType && (
            <button
              type="button"
              onClick={togglePassword}
              style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '28px',
                height: '28px',
                background: 'transparent',
                border: 'none',
                borderRadius: '2px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        </div>
        {addonRight && (
          <span 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '0.5rem 0.75rem', 
              background: 'var(--bg-surface-alt)', 
              border: '1px solid var(--border-default)', 
              borderLeft: 'none', 
              borderRadius: '0 2px 2px 0', 
              flexShrink: 0,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
            }}
          >
            {addonRight}
          </span>
        )}
      </div>
      
      {/* Error Message Container */}
      <div 
        id={errorId}
        style={{
          maxHeight: error ? '2rem' : '0',
          opacity: error ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.25s ease, opacity 0.25s ease',
          color: 'var(--status-error)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          marginTop: error ? '2px' : '0',
        }}
        aria-live="polite"
      >
        {error && `[!] ${error}`}
      </div>
    </div>
  );
}
