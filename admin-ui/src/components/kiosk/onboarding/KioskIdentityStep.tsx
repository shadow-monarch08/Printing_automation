// src/components/kiosk/onboarding/KioskIdentityStep.tsx
import React from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { Store, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { TouchKey } from '../keyboard/TouchKey';

export const KioskIdentityStep: React.FC = () => {
  const { shopName, adminPin, setShopName, setAdminPin, setStep, openKeyboard } = useKioskStore();

  const handleEditShopName = () => {
    openKeyboard({
      mode: 'alpha',
      label: 'ENTER SHOP NAME',
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
      label: 'SET 4-DIGIT ADMIN PIN',
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
        padding: '20px 24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header Title & Step Context */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <ShieldCheck size={18} color="var(--accent-primary, #FF5500)" />
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-primary, #E6E8EA)',
            }}
          >
            STEP 01/02 // IDENTITY & ACCESS SECURITY
          </span>
        </div>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary, #9098A2)',
            margin: '0 0 16px 0',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          Configure the terminal identity for receipt banners and establish your master admin PIN.
        </p>
      </div>

      {/* 2. Interactive Large Touch Tiles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
        {/* Tile 1: Shop Name */}
        <div
          onClick={handleEditShopName}
          style={{
            background: 'var(--bg-surface, #24282D)',
            border: '2px solid var(--border-default, #3A4047)',
            borderRadius: 'var(--radius-md, 6px)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'none',
            boxShadow: '0 4px 0 #000000',
            transition: 'border-color 0.15s ease',
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary, #FF5500)';
            e.currentTarget.style.transform = 'translateY(1px)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.transform = 'none';
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default, #3A4047)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                background: 'var(--bg-primary, #1A1D20)',
                border: '1px solid var(--border-default, #3A4047)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Store size={22} color="var(--accent-primary, #FF5500)" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                SHOP / BUSINESS NAME
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {shopName || <span style={{ color: 'var(--text-muted)' }}>[ TAP TO ENTER NAME ]</span>}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '6px 12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '2px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-primary)',
            }}
          >
            EDIT NAME ✎
          </div>
        </div>

        {/* Tile 2: Admin Master PIN */}
        <div
          onClick={handleEditPin}
          style={{
            background: 'var(--bg-surface, #24282D)',
            border: '2px solid var(--border-default, #3A4047)',
            borderRadius: 'var(--radius-md, 6px)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'none',
            boxShadow: '0 4px 0 #000000',
            transition: 'border-color 0.15s ease',
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary, #FF5500)';
            e.currentTarget.style.transform = 'translateY(1px)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.transform = 'none';
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default, #3A4047)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                background: 'var(--bg-primary, #1A1D20)',
                border: '1px solid var(--border-default, #3A4047)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Lock size={22} color="var(--accent-primary, #FF5500)" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                ADMIN MASTER PIN (4 DIGITS)
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: adminPin ? 'var(--accent-primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: adminPin ? '0.25em' : 'normal',
                }}
              >
                {adminPin ? '● ● ● ●' : '[ TAP TO SET 4-DIGIT PIN ]'}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '6px 12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '2px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: adminPin ? '#10B981' : 'var(--text-secondary)',
            }}
          >
            {adminPin ? 'PIN CONFIGURED ✓' : 'SET PIN 🔒'}
          </div>
        </div>
      </div>

      {/* 3. Bottom Action Bar */}
      <div style={{ marginTop: '16px' }}>
        <TouchKey
          label={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span>CONTINUE TO WI-FI SETUP</span>
              <ArrowRight size={20} />
            </div>
          }
          variant="action"
          height="54px"
          disabled={!isValid}
          onClick={() => setStep('WIFI_SCAN')}
        />
      </div>
    </div>
  );
};
