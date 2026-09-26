// src/components/kiosk/keyboard/TouchPinPad.tsx
import React, { useState } from 'react';
import { TouchKey } from './TouchKey';
import { Delete, X, Check, Lock } from 'lucide-react';

interface TouchPinPadProps {
  label: string;
  initialValue?: string;
  onSubmit: (pin: string) => void;
  onCancel?: () => void;
}

export const TouchPinPad: React.FC<TouchPinPadProps> = ({
  label,
  initialValue = '',
  onSubmit,
  onCancel,
}) => {
  const [pin, setPin] = useState(initialValue || '');

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        // Auto-focus or ready to confirm
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleConfirm = () => {
    if (pin.length === 4) {
      onSubmit(pin);
    }
  };

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
        padding: '10px 24px',
        gap: '8px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* 1. TOP HUD PREVIEW STRIP WITH 4 GLOWING PIN DOTS */}
      <div
        style={{
          height: '48px',
          background: 'var(--bg-surface, #24282D)',
          border: '1.5px solid var(--border-default, #3A4047)',
          borderRadius: 'var(--radius-sm, 4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={16} color="var(--accent-primary, #FF5500)" />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-primary, #E6E8EA)',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            {label}
          </span>
        </div>

        {/* 4 Large PIN Indicators */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = index < pin.length;
            return (
              <div
                key={index}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: isFilled ? '2px solid #FF5500' : '2px solid var(--border-default, #3A4047)',
                  background: isFilled ? 'var(--accent-primary, #FF5500)' : 'transparent',
                  boxShadow: isFilled ? '0 0 10px rgba(255, 85, 0, 0.6)' : 'none',
                  transition: 'all 0.15s ease-in-out',
                }}
              />
            );
          })}
        </div>

        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          [{pin.length}/4 DIGITS]
        </div>
      </div>

      {/* 2. NUMERIC 3x4 GRID + ACTIONS */}
      <div style={{ flex: 1, display: 'flex', gap: '16px' }}>
        {/* Numpad Column */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Row 1 */}
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <TouchKey label="1" height="42px" onClick={() => handleDigit('1')} />
            <TouchKey label="2" height="42px" onClick={() => handleDigit('2')} />
            <TouchKey label="3" height="42px" onClick={() => handleDigit('3')} />
          </div>

          {/* Row 2 */}
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <TouchKey label="4" height="42px" onClick={() => handleDigit('4')} />
            <TouchKey label="5" height="42px" onClick={() => handleDigit('5')} />
            <TouchKey label="6" height="42px" onClick={() => handleDigit('6')} />
          </div>

          {/* Row 3 */}
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <TouchKey label="7" height="42px" onClick={() => handleDigit('7')} />
            <TouchKey label="8" height="42px" onClick={() => handleDigit('8')} />
            <TouchKey label="9" height="42px" onClick={() => handleDigit('9')} />
          </div>

          {/* Row 4 */}
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <TouchKey label="CLR" variant="danger" height="42px" onClick={handleClear} />
            <TouchKey label="0" height="42px" onClick={() => handleDigit('0')} />
            <TouchKey
              label={<Delete size={20} />}
              variant="secondary"
              height="42px"
              onClick={handleBackspace}
            />
          </div>
        </div>

        {/* Action Column */}
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {onCancel && (
            <TouchKey
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <X size={18} />
                  <span>CANCEL</span>
                </div>
              }
              variant="danger"
              height="88px"
              onClick={onCancel}
            />
          )}

          <TouchKey
            label={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <Check size={22} />
                <span>CONFIRM</span>
              </div>
            }
            variant="action"
            height={onCancel ? '106px' : '200px'}
            disabled={pin.length !== 4}
            onClick={handleConfirm}
          />
        </div>
      </div>
    </div>
  );
};
