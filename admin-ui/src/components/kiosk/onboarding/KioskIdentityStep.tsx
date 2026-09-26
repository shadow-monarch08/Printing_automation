// src/components/kiosk/onboarding/KioskIdentityStep.tsx
import React from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { Store, Lock, ArrowRight, Check } from 'lucide-react';
import { Button } from '../../shared/Button';

export const KioskIdentityStep: React.FC = () => {
  const { shopName, adminPin, setShopName, setAdminPin, setStep, openKeyboard } = useKioskStore();

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
        padding: '24px 32px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      {/* 1. Welcoming Title */}
      <div>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: '0 0 6px 0',
          }}
        >
          Shop Setup
        </h1>
        <p
          style={{
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.65)',
            margin: 0,
            lineHeight: '1.4',
          }}
        >
          Set your business name and a 4-digit PIN to protect your settings.
        </p>
      </div>

      {/* 2. Clean, Spacious Input Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
        {/* Card 1: Shop Name */}
        <div
          onClick={handleEditShopName}
          style={{
            background: '#24282D',
            border: '1.5px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'none',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            transition: 'border-color 0.15s ease, transform 0.08s ease',
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.borderColor = '#FF5500';
            e.currentTarget.style.transform = 'translateY(1px)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.transform = 'none';
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                background: 'rgba(255, 85, 0, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Store size={22} color="#FF5500" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Shop Name
              </div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginTop: '2px' }}>
                {shopName || <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>Tap to enter name</span>}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            style={{
              height: '36px',
              padding: '0 14px',
              fontSize: '12px',
              fontWeight: 600,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleEditShopName();
            }}
          >
            Change
          </Button>
        </div>

        {/* Card 2: Admin Master PIN */}
        <div
          onClick={handleEditPin}
          style={{
            background: '#24282D',
            border: '1.5px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'none',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            transition: 'border-color 0.15s ease, transform 0.08s ease',
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.borderColor = '#FF5500';
            e.currentTarget.style.transform = 'translateY(1px)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.transform = 'none';
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                background: 'rgba(255, 85, 0, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Lock size={22} color="#FF5500" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Admin PIN
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: adminPin ? '#FF5500' : 'rgba(255, 255, 255, 0.3)',
                  marginTop: '2px',
                  letterSpacing: adminPin ? '0.25em' : 'normal',
                }}
              >
                {adminPin ? '● ● ● ●' : 'Tap to set 4-digit PIN'}
              </div>
            </div>
          </div>

          <Button
            variant={adminPin ? 'mechanical' : 'ghost'}
            leftIcon={adminPin ? <Check size={14} /> : undefined}
            style={{
              height: '36px',
              padding: '0 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: adminPin ? '#10B981' : '#FFFFFF',
              borderColor: adminPin ? 'rgba(16, 185, 129, 0.4)' : undefined,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleEditPin();
            }}
          >
            {adminPin ? 'Configured' : 'Set PIN'}
          </Button>
        </div>
      </div>

      {/* 3. Bottom Action Button */}
      <div>
        <Button
          variant="primary"
          disabled={!isValid}
          rightIcon={<ArrowRight size={18} />}
          onClick={() => setStep('WIFI_SCAN')}
          style={{ width: '100%', height: '50px', fontSize: '15px', fontWeight: 700 }}
        >
          Next: Connect to Wi-Fi
        </Button>
      </div>
    </div>
  );
};
