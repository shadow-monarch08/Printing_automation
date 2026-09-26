// src/components/kiosk/keyboard/TouchKeyboard.tsx
import React, { useState } from 'react';
import { TouchKey } from './TouchKey';
import { Eye, EyeOff, Delete, X, Check } from 'lucide-react';

interface TouchKeyboardProps {
  label: string;
  initialValue: string;
  isPassword?: boolean;
  maxLength?: number;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
}

const NUMBER_ROW = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const ALPHA_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const SYMBOL_ROWS = [
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
  ['-', '_', '+', '=', '{', '}', '[', ']', '\\', '|'],
  [':', ';', '"', "'", '<', '>', ',', '.', '?', '/'],
];

export const TouchKeyboard: React.FC<TouchKeyboardProps> = ({
  label,
  initialValue,
  isPassword = false,
  maxLength = 64,
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue || '');
  const [isCaps, setIsCaps] = useState(false);
  const [isSymbols, setIsSymbols] = useState(false);
  const [showPassword, setShowPassword] = useState(!isPassword);

  const handleKeyPress = (char: string) => {
    if (value.length >= maxLength) return;
    const finalChar = isCaps && !isSymbols ? char.toUpperCase() : char;
    setValue((prev) => prev + finalChar);
  };

  const handleBackspace = () => {
    setValue((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setValue('');
  };

  const handleConfirm = () => {
    onSubmit(value);
  };

  const currentRows = isSymbols ? SYMBOL_ROWS : ALPHA_ROWS;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '280px',
        background: 'var(--bg-primary, #1A1D20)',
        borderTop: '2px solid var(--accent-primary, #FF5500)',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.8)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        padding: '8px 12px 10px 12px',
        gap: '6px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* 1. TOP HUD PREVIEW STRIP (Height: ~46px) */}
      <div
        style={{
          height: '46px',
          background: 'var(--bg-surface, #24282D)',
          border: '1.5px solid var(--border-default, #3A4047)',
          borderRadius: 'var(--radius-sm, 4px)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          gap: '8px',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--accent-primary, #FF5500)',
            fontFamily: 'var(--font-mono, monospace)',
            whiteSpace: 'nowrap',
            borderRight: '1px solid var(--border-default, #3A4047)',
            paddingRight: '8px',
          }}
        >
          {label}
        </span>

        {/* Live Input Preview Box */}
        <div
          style={{
            flex: 1,
            height: '34px',
            background: '#111315',
            border: '1px solid var(--border-default, #3A4047)',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '15px',
            fontWeight: 700,
            color: '#FFFFFF',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value.length === 0 ? (
            <span style={{ color: 'var(--text-muted, #626A72)', fontWeight: 400 }}>Type here...</span>
          ) : isPassword && !showPassword ? (
            '•'.repeat(value.length)
          ) : (
            value
          )}
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '18px',
              background: 'var(--accent-primary, #FF5500)',
              marginLeft: '4px',
              animation: 'pulseLed 1s infinite alternate',
            }}
          />
        </div>

        {/* Password Visibility Toggle */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            style={{
              height: '34px',
              padding: '0 8px',
              background: 'var(--bg-surface-alt, #202327)',
              border: '1px solid var(--border-default, #3A4047)',
              borderRadius: '2px',
              color: showPassword ? 'var(--accent-primary)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'none',
            }}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showPassword ? 'HIDE' : 'SHOW'}</span>
          </button>
        )}

        {/* Quick Clear Button */}
        <button
          type="button"
          onClick={handleClear}
          disabled={value.length === 0}
          style={{
            height: '34px',
            padding: '0 10px',
            background: 'var(--bg-surface-alt, #202327)',
            border: '1px solid var(--border-default, #3A4047)',
            borderRadius: '2px',
            color: value.length > 0 ? '#EF4444' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            cursor: 'none',
          }}
        >
          CLR
        </button>

        {/* Backspace Button */}
        <button
          type="button"
          onClick={handleBackspace}
          disabled={value.length === 0}
          style={{
            height: '34px',
            padding: '0 10px',
            background: 'var(--bg-surface-alt, #202327)',
            border: '1px solid var(--border-default, #3A4047)',
            borderRadius: '2px',
            color: value.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            cursor: 'none',
          }}
        >
          <Delete size={14} />
          <span>⌫</span>
        </button>
      </div>

      {/* 2. NUMBER ROW */}
      <div style={{ display: 'flex', gap: '5px', height: '40px' }}>
        {NUMBER_ROW.map((num) => (
          <TouchKey key={num} label={num} height="40px" onClick={() => handleKeyPress(num)} />
        ))}
      </div>

      {/* 3. ROW 2 (QWERTY / SYMBOLS ROW 1) */}
      <div style={{ display: 'flex', gap: '5px', height: '40px' }}>
        {currentRows[0].map((char) => (
          <TouchKey
            key={char}
            label={isCaps && !isSymbols ? char.toUpperCase() : char}
            height="40px"
            onClick={() => handleKeyPress(char)}
          />
        ))}
      </div>

      {/* 4. ROW 3 (ASDF / SYMBOLS ROW 2) */}
      <div style={{ display: 'flex', gap: '5px', height: '40px', padding: '0 16px' }}>
        {currentRows[1].map((char) => (
          <TouchKey
            key={char}
            label={isCaps && !isSymbols ? char.toUpperCase() : char}
            height="40px"
            onClick={() => handleKeyPress(char)}
          />
        ))}
      </div>

      {/* 5. ROW 4 (ZXCV / SYMBOLS ROW 3 + CAPS & BACKSPACE) */}
      <div style={{ display: 'flex', gap: '5px', height: '40px' }}>
        <TouchKey
          label={isCaps ? 'CAPS [ON]' : 'CAPS'}
          variant={isCaps ? 'accent' : 'secondary'}
          flex={1.5}
          height="40px"
          onClick={() => setIsCaps((prev) => !prev)}
        />
        {currentRows[2].map((char) => (
          <TouchKey
            key={char}
            label={isCaps && !isSymbols ? char.toUpperCase() : char}
            height="40px"
            onClick={() => handleKeyPress(char)}
          />
        ))}
        <TouchKey
          label={<Delete size={18} />}
          variant="secondary"
          flex={1.5}
          height="40px"
          onClick={handleBackspace}
        />
      </div>

      {/* 6. BOTTOM ROW (CANCEL, SYMBOL TOGGLE, SPACEBAR, CONFIRM) */}
      <div style={{ display: 'flex', gap: '6px', height: '42px' }}>
        {onCancel && (
          <TouchKey
            label={
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <X size={16} />
                <span>CANCEL</span>
              </div>
            }
            variant="danger"
            flex={1.8}
            height="42px"
            onClick={onCancel}
          />
        )}

        <TouchKey
          label={isSymbols ? 'ABC' : '?123'}
          variant={isSymbols ? 'accent' : 'secondary'}
          flex={1.5}
          height="42px"
          onClick={() => setIsSymbols((prev) => !prev)}
        />

        <TouchKey
          label="SPACE"
          variant="default"
          flex={4}
          height="42px"
          onClick={() => handleKeyPress(' ')}
        />

        <TouchKey
          label={
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={18} />
              <span>CONFIRM</span>
            </div>
          }
          variant="action"
          flex={2.5}
          height="42px"
          onClick={handleConfirm}
        />
      </div>
    </div>
  );
};
