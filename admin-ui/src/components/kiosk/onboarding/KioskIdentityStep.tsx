// src/components/kiosk/onboarding/KioskIdentityStep.tsx
import React from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { Store, Lock, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button } from '../../shared/Button';

export const KioskIdentityStep: React.FC = () => {
  const { shopName, adminPin, setShopName, setAdminPin, setStep, openKeyboard, resetToChoice } = useKioskStore();

  const handleEditShopName = () => {
    openKeyboard({
      mode: 'alpha',
      label: 'Enter Shop Name',
      initialValue: shopName,
      maxLength: 32,
      onSubmit: (val) => {
        if (val.trim()) {
          setShopName(val.trim());
        }
      },
    });
  };

  const handleEditPin = () => {
    openKeyboard({
      mode: 'pin',
      label: 'Create 4-Digit Admin PIN',
      initialValue: adminPin,
      onSubmit: (val) => {
        if (val.length === 4) {
          setAdminPin(val);
        }
      },
    });
  };

  const isValid = shopName.trim().length > 0 && adminPin.length === 4;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* 1. Header with Back Button (Zero subtitles) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            variant="ghost"
            leftIcon={<ArrowLeft size={16} />}
            onClick={resetToChoice}
            style={{
              height: '38px',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            [ BACK ]
          </Button>

          <h1
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '0.02em',
            }}
          >
            SHOP SETUP
          </h1>
        </div>

        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--accent-primary)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm, 2px)',
          }}
        >
          [STEP 1 OF 2]
        </span>
      </div>

      {/* 2. Two Massive Interactive Input Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
        {/* Card 1: Shop Name */}
        <div
          onClick={handleEditShopName}
          style={{
            background: 'var(--bg-surface)',
            border: '2px solid var(--border-default)',
            borderRadius: 'var(--radius-lg, 6px)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'none',
            boxShadow: 'var(--shadow-paper)',
            transition: 'border-color 0.15s ease',
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-sm, 4px)',
                background: 'var(--accent-glow, rgba(255, 85, 0, 0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-default)',
              }}
            >
              <Store size={26} color="var(--accent-primary)" />
            </div>

            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.06em',
                }}
              >
                SHOP NAME
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: shopName ? 'var(--text-primary)' : 'var(--text-muted)',
                  marginTop: '2px',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {shopName || 'TAP TO ENTER NAME'}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            style={{
              height: '42px',
              padding: '0 16px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, monospace)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleEditShopName();
            }}
          >
            CHANGE
          </Button>
        </div>

        {/* Card 2: Admin Master PIN */}
        <div
          onClick={handleEditPin}
          style={{
            background: 'var(--bg-surface)',
            border: '2px solid var(--border-default)',
            borderRadius: 'var(--radius-lg, 6px)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'none',
            boxShadow: 'var(--shadow-paper)',
            transition: 'border-color 0.15s ease',
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-sm, 4px)',
                background: 'var(--accent-glow, rgba(255, 85, 0, 0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-default)',
              }}
            >
              <Lock size={26} color="var(--accent-primary)" />
            </div>

            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.06em',
                }}
              >
                ADMIN PIN (4 DIGITS)
              </div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: adminPin ? 'var(--accent-primary)' : 'var(--text-muted)',
                  marginTop: '2px',
                  letterSpacing: adminPin ? '0.3em' : 'normal',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {adminPin ? '● ● ● ●' : 'TAP TO SET PIN'}
              </div>
            </div>
          </div>

          <Button
            variant={adminPin ? 'mechanical' : 'primary'}
            leftIcon={adminPin ? <Check size={16} /> : undefined}
            style={{
              height: '42px',
              padding: '0 16px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, monospace)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleEditPin();
            }}
          >
            {adminPin ? 'CONFIGURED' : 'SET PIN'}
          </Button>
        </div>
      </div>

      {/* 3. Huge Bottom Action Button */}
      <div>
        <Button
          variant="primary"
          disabled={!isValid}
          rightIcon={<ArrowRight size={20} />}
          onClick={() => setStep('WIFI_SCAN')}
          style={{
            width: '100%',
            height: '56px',
            fontSize: '16px',
            fontWeight: 800,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.04em',
          }}
        >
          CONTINUE TO WI-FI ➔
        </Button>
      </div>
    </div>
  );
};
