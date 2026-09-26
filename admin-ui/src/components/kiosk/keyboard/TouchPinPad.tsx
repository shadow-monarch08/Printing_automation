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
      setPin((prev) => prev + digit);
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
        height: '420px',
        background: '#1A1D20',
        borderTop: '2px solid #FF5500',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.9)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        padding: '12px 24px',
        gap: '12px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* 1. TOP HUD PREVIEW STRIP WITH 4 GLOWING PIN DOTS */}
      <div
        style={{
          height: '52px',
          background: '#24282D',
          border: '1.5px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Lock size={18} color="#FF5500" />
          <span
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#FFFFFF',
              fontFamily: 'var(--font-body, sans-serif)',
            }}
          >
            {label}
          </span>
        </div>

        {/* 4 Large Glowing PIN Dots */}
        <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = index < pin.length;
            return (
              <div
                key={index}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: isFilled ? '2px solid #FF5500' : '2px solid rgba(255, 255, 255, 0.25)',
                  background: isFilled ? '#FF5500' : 'transparent',
                  boxShadow: isFilled ? '0 0 12px rgba(255, 85, 0, 0.8)' : 'none',
                  transition: 'all 0.12s ease-in-out',
                }}
              />
            );
          })}
        </div>

        <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)' }}>
          {pin.length} of 4 digits
        </div>
      </div>

      {/* 2. MASSIVE NUMERIC 3x4 GRID + ACTIONS */}
      <div style={{ flex: 1, display: 'flex', gap: '16px' }}>
        {/* Numpad Column */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Row 1 */}
          <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
            <TouchKey label="1" height="100%" onClick={() => handleDigit('1')} />
            <TouchKey label="2" height="100%" onClick={() => handleDigit('2')} />
            <TouchKey label="3" height="100%" onClick={() => handleDigit('3')} />
          </div>

          {/* Row 2 */}
          <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
            <TouchKey label="4" height="100%" onClick={() => handleDigit('4')} />
            <TouchKey label="5" height="100%" onClick={() => handleDigit('5')} />
            <TouchKey label="6" height="100%" onClick={() => handleDigit('6')} />
          </div>

          {/* Row 3 */}
          <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
            <TouchKey label="7" height="100%" onClick={() => handleDigit('7')} />
            <TouchKey label="8" height="100%" onClick={() => handleDigit('8')} />
            <TouchKey label="9" height="100%" onClick={() => handleDigit('9')} />
          </div>

          {/* Row 4 */}
          <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
            <TouchKey label="CLR" variant="danger" height="100%" onClick={handleClear} />
            <TouchKey label="0" height="100%" onClick={() => handleDigit('0')} />
            <TouchKey
              label={<Delete size={22} />}
              variant="secondary"
              height="100%"
              onClick={handleBackspace}
            />
          </div>
        </div>

        {/* Action Column */}
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {onCancel && (
            <TouchKey
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px' }}>
                  <X size={20} />
                  <span>Cancel</span>
                </div>
              }
              variant="danger"
              height="120px"
              onClick={onCancel}
            />
          )}

          <TouchKey
            label={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '16px' }}>
                <Check size={28} />
                <span>Confirm</span>
              </div>
            }
            variant="action"
            height={onCancel ? '200px' : '330px'}
            disabled={pin.length !== 4}
            onClick={handleConfirm}
          />
        </div>
      </div>
    </div>
  );
};
