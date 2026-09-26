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

const ALPHA_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const SYMBOL_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['!', '@', '#', '$', '%', '&', '*', '(', ')'],
  ['-', '_', '+', '=', '/', '\\', ':', ';', '.'],
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
        height: '420px',
        background: '#1A1D20',
        borderTop: '2px solid #FF5500',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.9)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        padding: '10px 14px 12px 14px',
        gap: '8px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* 1. TOP HUD PREVIEW STRIP (Height: 52px) */}
      <div
        style={{
          height: '52px',
          background: '#24282D',
          border: '1.5px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: '10px',
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
            paddingRight: '10px',
          }}
        >
          {label}
        </span>

        {/* Live Input Preview Box */}
        <div
          style={{
            flex: 1,
            height: '40px',
            background: '#111315',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '18px',
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
              width: '10px',
              height: '22px',
              background: '#FF5500',
              marginLeft: '4px',
            }}
          />
        </div>

        {/* Password Visibility Toggle */}
        {isPassword && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setShowPassword((prev) => !prev);
            }}
            style={{
              height: '40px',
              padding: '0 12px',
              background: '#2D3238',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
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

        {/* Clear Button */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            handleClear();
          }}
          disabled={value.length === 0}
          style={{
            height: '40px',
            padding: '0 14px',
            background: '#2D3238',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '4px',
            color: value.length > 0 ? '#EF4444' : 'rgba(255, 255, 255, 0.3)',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'none',
            touchAction: 'none',
          }}
        >
          CLR
        </button>

        {/* Backspace Button */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            handleBackspace();
          }}
          disabled={value.length === 0}
          style={{
            height: '40px',
            padding: '0 14px',
            background: '#2D3238',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '4px',
            color: value.length > 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'none',
            touchAction: 'none',
          }}
        >
          <Delete size={16} />
          <span>⌫</span>
        </button>
      </div>

      {/* 2. ROW 1 (QWERTY / NUMBERS) - Height ~70px */}
      <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
        {currentRows[0].map((char) => (
          <TouchKey
            key={char}
            label={isCaps && !isSymbols ? char.toUpperCase() : char}
            height="100%"
            onClick={() => handleKeyPress(char)}
          />
        ))}
      </div>

      {/* 3. ROW 2 (ASDF / SYMBOLS) - Height ~70px */}
      <div style={{ display: 'flex', gap: '8px', flex: 1, padding: '0 24px' }}>
        {currentRows[1].map((char) => (
          <TouchKey
            key={char}
            label={isCaps && !isSymbols ? char.toUpperCase() : char}
            height="100%"
            onClick={() => handleKeyPress(char)}
          />
        ))}
      </div>

      {/* 4. ROW 3 (ZXCV + CAPS & BACKSPACE) - Height ~70px */}
      <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
        <TouchKey
          label={isCaps ? 'CAPS [ON]' : 'CAPS'}
          variant={isCaps ? 'accent' : 'secondary'}
          flex={1.5}
          height="100%"
          onClick={() => setIsCaps((prev) => !prev)}
        />
        {currentRows[2].map((char) => (
          <TouchKey
            key={char}
            label={isCaps && !isSymbols ? char.toUpperCase() : char}
            height="100%"
            onClick={() => handleKeyPress(char)}
          />
        ))}
        <TouchKey
          label={
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Delete size={20} />
              <span>DEL</span>
            </div>
          }
          variant="secondary"
          flex={1.5}
          height="100%"
          onClick={handleBackspace}
        />
      </div>

      {/* 5. BOTTOM ROW (CANCEL, SYMBOL TOGGLE, SPACE, CONFIRM) - Height ~72px */}
      <div style={{ display: 'flex', gap: '10px', height: '72px' }}>
        {onCancel && (
          <TouchKey
            label={
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <X size={18} />
                <span>Cancel</span>
              </div>
            }
            variant="danger"
            flex={1.8}
            height="100%"
            onClick={onCancel}
          />
        )}

        <TouchKey
          label={isSymbols ? 'ABC' : '?123'}
          variant={isSymbols ? 'accent' : 'secondary'}
          flex={1.6}
          height="100%"
          onClick={() => setIsSymbols((prev) => !prev)}
        />

        <TouchKey
          label="SPACE"
          variant="default"
          flex={4.5}
          height="100%"
          onClick={() => handleKeyPress(' ')}
        />

        <TouchKey
          label={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px' }}>
              <Check size={22} />
              <span>Confirm</span>
            </div>
          }
          variant="action"
          flex={2.5}
          height="100%"
          onClick={handleConfirm}
        />
      </div>
    </div>
  );
};
