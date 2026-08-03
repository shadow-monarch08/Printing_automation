import React, { useState, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { soundFx } from '../../utils/sound';

export interface PinInputProps {
  label?: string;
  value: string[];
  onChange: (newValue: string[]) => void;
  error?: string;
  autoFocus?: boolean;
}

export function PinInput({ label, value, onChange, error, autoFocus = false }: PinInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(autoFocus ? 0 : null);

  const slotRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleDigitChange = (index: number, val: string) => {
    soundFx.playClick();
    const cleanVal = val.replace(/\D/g, '').slice(-1);
    const nextValue = [...value];
    nextValue[index] = cleanVal;

    onChange(nextValue);

    if (cleanVal && index < 3) {
      slotRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      soundFx.playClick();
      slotRefs[index - 1].current?.focus();
    }
  };

  const toggleShowPassword = () => {
    soundFx.playClick();
    setShowPassword(!showPassword);
  };

  return (
    <div className="pin-input-component" style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'block',
          }}
        >
          {label}
        </label>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
        <div className="pin-digit-grid" style={{ display: 'flex', gap: '10px', flex: 1, justifyContent: 'space-between' }}>
          {[0, 1, 2, 3].map((idx) => {
            const isFocused = focusedIndex === idx;
            const hasValue = !!value[idx];

            return (
              <div
                key={`slot-${idx}`}
                className={`pin-digit-slot ${hasValue ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
                style={{
                  position: 'relative',
                  flex: 1,
                  maxWidth: '52px',
                  height: '52px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isFocused ? 'rgba(255, 107, 0, 0.06)' : 'var(--bg-primary)',
                  border: '2px solid',
                  borderColor: isFocused
                    ? 'var(--accent-primary)'
                    : hasValue
                    ? 'var(--accent-primary)'
                    : 'var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: isFocused
                    ? '0 0 0 3px rgba(255, 107, 0, 0.3), 0 4px 12px rgba(255, 107, 0, 0.2)'
                    : hasValue
                    ? '0 4px 0 var(--accent-primary)'
                    : '0 4px 0 var(--border-default)',
                  transform: isFocused ? 'translateY(-2px)' : 'none',
                  transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={() => slotRefs[idx].current?.focus()}
              >
                <input
                  ref={slotRefs[idx]}
                  type={showPassword ? 'text' : 'password'}
                  maxLength={1}
                  value={value[idx] || ''}
                  autoFocus={autoFocus && idx === 0}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onFocus={() => setFocusedIndex(idx)}
                  onBlur={() => setFocusedIndex(null)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 2,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: showPassword ? '20px' : '24px',
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                    userSelect: 'none',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                >
                  {value[idx] ? (showPassword ? value[idx] : '•') : isFocused ? '|' : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* View Password Toggle Button */}
        <button
          type="button"
          onClick={toggleShowPassword}
          aria-label={showPassword ? 'Hide password' : 'View password'}
          style={{
            width: '42px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            color: showPassword ? 'var(--accent-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.color = 'var(--accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.color = showPassword ? 'var(--accent-primary)' : 'var(--text-secondary)';
          }}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {error && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--status-error)',
            marginTop: '4px',
          }}
        >
          [ERROR] {error}
        </div>
      )}
    </div>
  );
}
