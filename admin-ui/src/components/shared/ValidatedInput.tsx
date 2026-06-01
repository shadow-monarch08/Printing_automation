import React, { useState, useId } from 'react';

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
  className?: string; // Optional override/addition
  addonLeft?: React.ReactNode;
  addonRight?: React.ReactNode;
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
}: ValidatedInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<boolean>(false);
  
  const generatedId = useId();
  const inputId = name || generatedId;
  const errorId = `${inputId}-error`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    // 1. Sanitize
    if (sanitizeFn) {
      newValue = sanitizeFn(newValue);
    }

    // 2. UX Recovery (if already touched and showing an error, clear it if valid now)
    if (touched && error && validateFn) {
      const validationError = validateFn(newValue);
      if (!validationError) {
        setError(null);
      }
    }

    // 3. Inform parent
    onChange(newValue);
  };

  const handleBlur = () => {
    setTouched(true);
    if (validateFn) {
      const validationError = validateFn(value);
      setError(validationError);
    }
  };

  return (
    <div className={`validated-input-container ${className}`} style={{ marginBottom: '1rem', width: '100%' }}>
      {label && (
        <label 
          htmlFor={inputId} 
          className="custom-select-label" 
          style={{ display: 'block', marginBottom: '0.5rem' }}
        >
          {label}
        </label>
      )}
      <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
        {addonLeft && (
          <span 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '0.6rem 1rem', 
              background: 'var(--bg-surface-alt)', 
              border: '1px solid var(--input-border)', 
              borderRight: 'none', 
              borderRadius: '2px 0 0 2px', 
              flexShrink: 0,
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
            }}
          >
            {addonLeft}
          </span>
        )}
        <input
          id={inputId}
          name={name}
          type={type}
          className="input-field"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-errormessage={error ? errorId : undefined}
          style={{
            width: '100%',
            borderColor: error ? 'var(--status-error)' : undefined,
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            borderTopLeftRadius: addonLeft ? 0 : undefined,
            borderBottomLeftRadius: addonLeft ? 0 : undefined,
            borderTopRightRadius: addonRight ? 0 : undefined,
            borderBottomRightRadius: addonRight ? 0 : undefined,
          }}
        />
        {addonRight && (
          <span 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '0.6rem 1rem', 
              background: 'var(--bg-surface-alt)', 
              border: '1px solid var(--input-border)', 
              borderLeft: 'none', 
              borderRadius: '0 2px 2px 0', 
              flexShrink: 0,
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
            }}
          >
            {addonRight}
          </span>
        )}
      </div>
      
      {/* Error Message Container (Smooth CSS Transition via max-height) */}
      <div 
        id={errorId}
        style={{
          maxHeight: error ? '2rem' : '0',
          opacity: error ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease, opacity 0.3s ease',
          color: 'var(--status-error)',
          fontSize: '0.8rem',
          marginTop: error ? '0.25rem' : '0',
        }}
        aria-live="polite"
      >
        {error}
      </div>
    </div>
  );
}
