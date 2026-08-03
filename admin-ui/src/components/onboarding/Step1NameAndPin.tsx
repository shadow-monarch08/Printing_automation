import React, { useState, useRef } from 'react';
import { Button } from '../shared/Button';
import { ValidatedInput } from '../shared/ValidatedInput';
import { soundFx } from '../../utils/sound';

interface Step1NameAndPinProps {
  initialShopName: string;
  onComplete: (shopName: string, adminPin: string) => void;
}

export function Step1NameAndPin({ initialShopName, onComplete }: Step1NameAndPinProps) {
  const [shopName, setShopName] = useState(initialShopName || 'Modern Press');
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');

  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const confirmPinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handlePinChange = (index: number, val: string, isConfirm: boolean = false) => {
    soundFx.playClick();
    const cleanVal = val.replace(/\D/g, '').slice(-1);
    const state = isConfirm ? [...confirmPin] : [...pin];
    const setState = isConfirm ? setConfirmPin : setPin;
    const refs = isConfirm ? confirmPinRefs : pinRefs;

    state[index] = cleanVal;
    setState(state);
    setError('');

    if (cleanVal && index < 3) {
      refs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent, isConfirm: boolean = false) => {
    const state = isConfirm ? confirmPin : pin;
    const refs = isConfirm ? confirmPinRefs : pinRefs;

    if (e.key === 'Backspace' && !state[index] && index > 0) {
      soundFx.playClick();
      refs[index - 1].current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playClick();

    const pinStr = pin.join('');
    const confirmPinStr = confirmPin.join('');

    if (!shopName.trim()) {
      setError('Equipment shop name is required.');
      return;
    }

    if (pinStr.length !== 4) {
      setError('Master PIN must be exactly 4 numeric digits.');
      return;
    }

    if (pinStr !== confirmPinStr) {
      setError('Confirmation PIN does not match Master PIN.');
      return;
    }

    onComplete(shopName.trim(), pinStr);
  };

  const isFormValid = shopName.trim().length > 0 && pin.join('').length === 4 && pin.join('') === confirmPin.join('');

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Shop Name Field */}
      <div>
        <label
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '6px',
            display: 'block',
          }}
        >
          [EQUIPMENT_TAG // SHOP_NAME]
        </label>
        <ValidatedInput
          value={shopName}
          onChange={setShopName}
          placeholder="Enter business / shop name..."
        />
      </div>

      {/* Master PIN Field */}
      <div>
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
          [MASTER_SECURITY_PIN // 4_DIGITS]
        </label>
        <div className="pin-digit-grid">
          {pin.map((digit, idx) => (
            <div
              key={`pin-${idx}`}
              className={`pin-digit-slot ${digit ? 'active' : ''}`}
              onClick={() => pinRefs[idx].current?.focus()}
            >
              <input
                ref={pinRefs[idx]}
                type="password"
                maxLength={1}
                value={digit}
                onChange={e => handlePinChange(idx, e.target.value, false)}
                onKeyDown={e => handleKeyDown(idx, e, false)}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer',
                }}
              />
              {digit ? '•' : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Confirm PIN Field */}
      <div>
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
          [CONFIRM_SECURITY_PIN]
        </label>
        <div className="pin-digit-grid">
          {confirmPin.map((digit, idx) => (
            <div
              key={`cpin-${idx}`}
              className={`pin-digit-slot ${digit ? 'active' : ''}`}
              onClick={() => confirmPinRefs[idx].current?.focus()}
            >
              <input
                ref={confirmPinRefs[idx]}
                type="password"
                maxLength={1}
                value={digit}
                onChange={e => handlePinChange(idx, e.target.value, true)}
                onKeyDown={e => handleKeyDown(idx, e, true)}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer',
                }}
              />
              {digit ? '•' : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            background: 'rgba(255, 68, 68, 0.08)',
            border: '1px solid var(--border-default)',
            borderLeft: '4px solid var(--status-error)',
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--status-error)',
          }}
        >
          [ERROR] {error}
        </div>
      )}

      {/* Action Button */}
      <Button
        type="submit"
        variant="primary"
        disabled={!isFormValid}
        style={{
          width: '100%',
          height: '48px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop: '8px',
        }}
      >
        CONTINUE TO WI-FI PROVISIONING ➔
      </Button>
    </form>
  );
}
