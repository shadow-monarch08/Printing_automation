// src/components/kiosk/keyboard/TouchKeyboard.tsx
import React, { useState } from 'react';
import { TouchKey } from './TouchKey';
import { Eye, EyeOff, Delete, X, Check, Trash2 } from 'lucide-react';

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
  ['-', '_', '+', '=', '/', '\\', ':', ';', '"'],
  ['?', '<', '>', '[', ']', '{', '}', '\''],
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

  const currentLetterRows = isSymbols ? SYMBOL_ROWS : ALPHA_ROWS;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '420px',
        background: '#16181B',
        borderTop: '2px solid #FF5500',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.9)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        padding: '8px 18px 26px 18px',
        gap: '6px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* 1. TOP HUD PREVIEW STRIP (Cleaned: No redundant small DEL/CLR buttons) */}
      <div
        style={{
          height: '46px',
          background: '#22262B',
          border: '1.5px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: '12px',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#FF5500',
            fontFamily: 'var(--font-body, sans-serif)',
            whiteSpace: 'nowrap',
            borderRight: '1px solid rgba(255, 255, 255, 0.15)',
            paddingRight: '12px',
          }}
        >
          {label}
        </span>

        {/* Live Input Preview Box (Takes full remaining space) */}
        <div
          style={{
            flex: 1,
            height: '36px',
            background: '#111315',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '17px',
            fontWeight: 700,
            color: '#FFFFFF',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value.length === 0 ? (
            <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 400 }}>Type here...</span>
          ) : isPassword && !showPassword ? (
            '•'.repeat(value.length)
          ) : (
            value
          )}
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '20px',
              background: '#FF5500',
              marginLeft: '4px',
            }}
          />
        </div>

        {/* Password Visibility Toggle (Only if password field) */}
        {isPassword && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setShowPassword((prev) => !prev);
            }}
            style={{
              height: '36px',
              padding: '0 12px',
              background: '#2D3238',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: showPassword ? '#FF5500' : 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'none',
              touchAction: 'none',
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>{showPassword ? 'Hide' : 'Show'}</span>
          </button>
        )}
      </div>

      {/* 2. DEDICATED PERMANENT NUMBER ROW (1 2 3 4 5 6 7 8 9 0) */}
      <div style={{ display: 'flex', gap: '6px', flex: 1, minHeight: 0 }}>
        {NUMBER_ROW.map((digit) => (
          <TouchKey
            key={digit}
            label={digit}
            height="100%"
            onClick={() => handleKeyPress(digit)}
            style={{ fontSize: '18px', fontWeight: 700 }}
          />
        ))}
      </div>

      {/* 3. ROW 1 (QWERTY / SYMBOLS) */}
      <div style={{ display: 'flex', gap: '6px', flex: 1, minHeight: 0 }}>
        {currentLetterRows[0].map((char) => (
          <TouchKey
            key={char}
            label={isCaps && !isSymbols ? char.toUpperCase() : char}
            height="100%"
            onClick={() => handleKeyPress(char)}
            style={{ fontSize: '18px' }}
          />
        ))}
      </div>

      {/* 4. ROW 2 (ASDF / SYMBOLS) */}
      <div style={{ display: 'flex', gap: '6px', flex: 1, minHeight: 0, padding: '0 20px' }}>
        {currentLetterRows[1].map((char) => (
          <TouchKey
            key={char}
            label={isCaps && !isSymbols ? char.toUpperCase() : char}
            height="100%"
            onClick={() => handleKeyPress(char)}
            style={{ fontSize: '18px' }}
          />
        ))}
      </div>

      {/* 5. ROW 3 (ZXCV + CAPS & DEL) */}
      <div style={{ display: 'flex', gap: '6px', flex: 1, minHeight: 0 }}>
        <TouchKey
          label={isCaps ? 'CAPS [ON]' : 'CAPS'}
          variant={isCaps ? 'accent' : 'secondary'}
          flex={1.4}
          height="100%"
          onClick={() => setIsCaps((prev) => !prev)}
          style={{ fontSize: '14px' }}
        />
        {currentLetterRows[2].map((char) => (
          <TouchKey
            key={char}
            label={isCaps && !isSymbols ? char.toUpperCase() : char}
            height="100%"
            onClick={() => handleKeyPress(char)}
            style={{ fontSize: '18px' }}
          />
        ))}
        <TouchKey
          label={
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Delete size={20} />
              <span>DEL</span>
            </div>
          }
          variant="secondary"
          flex={1.4}
          height="100%"
          onClick={handleBackspace}
          style={{ fontSize: '14px' }}
        />
      </div>

      {/* 6. BOTTOM ROW (CANCEL, SYMBOL TOGGLE, SPACE, BIG CLR, CONFIRM) */}
      <div style={{ display: 'flex', gap: '8px', flex: 1.1, minHeight: 0 }}>
        {onCancel && (
          <TouchKey
            label={
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <X size={18} />
                <span>Cancel</span>
              </div>
            }
            variant="secondary"
            flex={1.6}
            height="100%"
            onClick={onCancel}
            style={{ fontSize: '15px' }}
          />
        )}

        <TouchKey
          label={isSymbols ? 'ABC' : '?123'}
          variant={isSymbols ? 'accent' : 'secondary'}
          flex={1.4}
          height="100%"
          onClick={() => setIsSymbols((prev) => !prev)}
          style={{ fontSize: '15px' }}
        />

        <TouchKey
          label="SPACE"
          variant="default"
          flex={3.0}
          height="100%"
          onClick={() => handleKeyPress(' ')}
          style={{ fontSize: '15px', letterSpacing: '0.1em' }}
        />

        {/* Large Ergonomic CLR Button without affecting other key sizes */}
        <TouchKey
          label={
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Trash2 size={16} />
              <span>CLR</span>
            </div>
          }
          variant="danger"
          flex={1.3}
          height="100%"
          onClick={handleClear}
          style={{ fontSize: '14px' }}
        />

        <TouchKey
          label={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
              <Check size={22} />
              <span>Confirm</span>
            </div>
          }
          variant="action"
          flex={2.2}
          height="100%"
          onClick={handleConfirm}
        />
      </div>
    </div>
  );
};
