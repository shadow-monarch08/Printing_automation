// src/components/kiosk/keyboard/TouchPinPad.tsx
import React, { useState } from 'react';
import { TouchKey } from './TouchKey';
import { Delete, X, Check, Lock, AlertCircle } from 'lucide-react';

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
  const [validationError, setValidationError] = useState(false);

  const handleDigit = (digit: string) => {
    if (validationError) setValidationError(false);
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (validationError) setValidationError(false);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (validationError) setValidationError(false);
    setPin('');
  };

  const handleConfirm = () => {
    if (pin.length === 4) {
      onSubmit(pin);
    } else {
      setValidationError(true);
      setTimeout(() => setValidationError(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '420px',
        background: 'var(--bg-primary, #1A1D20)',
        borderTop: '2px solid var(--accent-primary, #FF5500)',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        padding: '10px 24px 28px 24px',
        gap: '10px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* 1. TOP HUD PREVIEW STRIP WITH 4 GLOWING PIN DOTS */}
      <div
        style={{
          height: '48px',
          background: validationError ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface, #24282D)',
          border: validationError ? '1.5px solid var(--status-error, #EF4444)' : '1.5px solid var(--border-default, #3A4047)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {validationError ? (
            <AlertCircle size={20} color="var(--status-error, #EF4444)" />
          ) : (
            <Lock size={18} color="var(--accent-primary, #FF5500)" />
          )}
          <span
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: validationError ? 'var(--status-error, #EF4444)' : 'var(--text-primary, #FFFFFF)',
              fontFamily: 'var(--font-body, sans-serif)',
            }}
          >
            {validationError ? 'Please enter all 4 digits' : label}
          </span>
        </div>

        {/* 4 Large Glowing PIN Dots */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = index < pin.length;
            const dotColor = validationError ? 'var(--status-error, #EF4444)' : 'var(--accent-primary, #FF5500)';
            return (
              <div
                key={index}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: isFilled
                    ? `2px solid ${dotColor}`
                    : validationError
                    ? '2px solid rgba(239, 68, 68, 0.5)'
                    : '2px solid var(--border-default, #3A4047)',
                  background: isFilled ? dotColor : 'transparent',
                  boxShadow: isFilled
                    ? `0 0 14px ${dotColor}`
                    : 'none',
                  transition: 'all 0.12s ease-in-out',
                }}
              />
            );
          })}
        </div>

        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: validationError ? 'var(--status-error, #EF4444)' : 'var(--text-secondary, rgba(255, 255, 255, 0.65))',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {pin.length}/4
        </div>
      </div>

      {/* 2. MASSIVE NUMERIC 3x4 GRID + ACTIONS */}
      <div style={{ flex: 1, display: 'flex', gap: '14px', minHeight: 0 }}>
        {/* Numpad Column (Flex 3) */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Row 1 */}
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <TouchKey label="1" height="100%" onClick={() => handleDigit('1')} style={{ fontSize: '24px' }} />
            <TouchKey label="2" height="100%" onClick={() => handleDigit('2')} style={{ fontSize: '24px' }} />
            <TouchKey label="3" height="100%" onClick={() => handleDigit('3')} style={{ fontSize: '24px' }} />
          </div>

          {/* Row 2 */}
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <TouchKey label="4" height="100%" onClick={() => handleDigit('4')} style={{ fontSize: '24px' }} />
            <TouchKey label="5" height="100%" onClick={() => handleDigit('5')} style={{ fontSize: '24px' }} />
            <TouchKey label="6" height="100%" onClick={() => handleDigit('6')} style={{ fontSize: '24px' }} />
          </div>

          {/* Row 3 */}
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <TouchKey label="7" height="100%" onClick={() => handleDigit('7')} style={{ fontSize: '24px' }} />
            <TouchKey label="8" height="100%" onClick={() => handleDigit('8')} style={{ fontSize: '24px' }} />
            <TouchKey label="9" height="100%" onClick={() => handleDigit('9')} style={{ fontSize: '24px' }} />
          </div>

          {/* Row 4 */}
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <TouchKey
              label="CLR"
              variant="danger"
              height="100%"
              onClick={handleClear}
              style={{ fontSize: '16px' }}
            />
            <TouchKey label="0" height="100%" onClick={() => handleDigit('0')} style={{ fontSize: '24px' }} />
            <TouchKey
              label={<Delete size={24} />}
              variant="secondary"
              height="100%"
              onClick={handleBackspace}
            />
          </div>
        </div>

        {/* Action Column (Flex 1.2) */}
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {onCancel && (
            <TouchKey
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                  <X size={22} />
                  <span>Cancel</span>
                </div>
              }
              variant="secondary"
              height="110px"
              onClick={onCancel}
            />
          )}

          <TouchKey
            label={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                <Check size={32} />
                <span>Confirm</span>
              </div>
            }
            variant="action"
            height={onCancel ? '180px' : '300px'}
            onClick={handleConfirm}
          />
        </div>
      </div>
    </div>
  );
};
