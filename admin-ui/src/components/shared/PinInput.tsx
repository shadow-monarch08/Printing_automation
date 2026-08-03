import React, { useState, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { soundFx } from '../../utils/sound';

export interface PinInputProps {
  label?: string;
  value: string[];
  onChange: (newValue: string[]) => void;
  error?: string;
}

export function PinInput({ label, value, onChange, error }: PinInputProps) {
  const [showPassword, setShowPassword] = useState(false);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="pin-digit-grid" style={{ display: 'flex', gap: '12px' }}>
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={`slot-${idx}`}
              className={`pin-digit-slot ${value[idx] ? 'active' : ''}`}
              style={{
                position: 'relative',
                width: '52px',
                height: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-primary)',
                border: '2px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: value[idx] ? '0 4px 0 var(--accent-primary)' : '0 4px 0 var(--border-default)',
                borderColor: value[idx] ? 'var(--accent-primary)' : 'var(--border-default)',
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
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
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
                {value[idx] ? (showPassword ? value[idx] : '•') : ''}
              </span>
            </div>
          ))}
        </div>

        {/* View Password Toggle Button */}
        <button
          type="button"
          onClick={toggleShowPassword}
          aria-label={showPassword ? 'Hide password' : 'View password'}
          style={{
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            color: showPassword ? 'var(--accent-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
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
