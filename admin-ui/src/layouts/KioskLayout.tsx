// src/layouts/KioskLayout.tsx
import React, { useState, useEffect } from 'react';
import { useKioskStore } from '../stores/useKioskStore';
import { KioskHeader } from '../components/kiosk/common/KioskHeader';
import { TouchKeyboard } from '../components/kiosk/keyboard/TouchKeyboard';
import { TouchPinPad } from '../components/kiosk/keyboard/TouchPinPad';

interface KioskLayoutProps {
  children: React.ReactNode;
}

export const KioskLayout: React.FC<KioskLayoutProps> = ({ children }) => {
  const {
    shopName,
    step,
    kioskSummary,
    keyboard,
    closeKeyboard,
  } = useKioskStore();

  const [burnInOffset, setBurnInOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. LCD Burn-in Protection: Subtle 2px pixel shift every 15 minutes
  useEffect(() => {
    const offsets = [
      { x: 0, y: 0 },
      { x: 2, y: 1 },
      { x: -1, y: 2 },
      { x: 1, y: -2 },
      { x: -2, y: -1 },
    ];
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % offsets.length;
      setBurnInOffset(offsets[index]);
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const isOnboarded = kioskSummary?.isOnboarded || step === 'OPERATIONAL';
  const isProvisioning = step === 'PROVISIONING';

  const getStepIndicator = () => {
    switch (step) {
      case 'IDENTITY':
        return 'Step 1 of 2';
      case 'WIFI_SCAN':
        return 'Step 2 of 2';
      case 'PROVISIONING':
        return 'Connecting...';
      case 'OPERATIONAL':
      default:
        return undefined;
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-primary, #1A1D20)',
        color: 'var(--text-primary, #E6E8EA)',
        fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        transform: `translate(${burnInOffset.x}px, ${burnInOffset.y}px)`,
        transition: 'transform 1s ease-in-out',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: 'none',
      }}
    >
      <style>{`
        *, *::before, *::after, html, body {
          cursor: none !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }
        @keyframes pulseLed {
          0% { opacity: 0.4; }
          100% { opacity: 1; }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* 1. Persistent Hardware Header (40px) */}
      <KioskHeader
        shopName={shopName}
        isOnboarded={isOnboarded}
        isProvisioning={isProvisioning}
        stepIndicator={getStepIndicator()}
      />

      {/* 2. Main Viewport Content (440px) */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {children}
      </main>

      {/* 3. Docked Touch Keyboard Overlay (>50% Screen) */}
      {keyboard.isOpen && (
        <>
          {/* Dimmed non-dismissible backdrop over upper margin */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: 'calc(100% - 420px)',
              background: 'rgba(0, 0, 0, 0.6)',
              zIndex: 999,
              cursor: 'none',
              touchAction: 'none',
            }}
          />

          {keyboard.mode === 'pin' ? (
            <TouchPinPad
              label={keyboard.label}
              initialValue={keyboard.initialValue}
              onSubmit={(pin) => {
                keyboard.onSubmit(pin);
                closeKeyboard();
              }}
              onCancel={closeKeyboard}
            />
          ) : (
            <TouchKeyboard
              label={keyboard.label}
              initialValue={keyboard.initialValue}
              isPassword={keyboard.isPassword}
              maxLength={keyboard.maxLength}
              onSubmit={(val) => {
                keyboard.onSubmit(val);
                closeKeyboard();
              }}
              onCancel={closeKeyboard}
            />
          )}
        </>
      )}
    </div>
  );
};
