// src/components/kiosk/onboarding/KioskMobileHandoffStep.tsx
import React from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../../shared/Button';

export const KioskMobileHandoffStep: React.FC = () => {
  const { cancelMobileMode, startScreenMode, errorMessage } = useKioskStore();

  const wifiQrPayload = 'WIFI:S:Kiosk-Hotspot;T:nopass;;';
  const portalUrl = 'http://192.168.4.1:3000/setup';

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 20px',
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'var(--status-idle, #00FF88)',
              boxShadow: '0 0 10px var(--status-idle, #00FF88)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <h1
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '22px',
              fontWeight: 900,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '0.02em',
            }}
          >
            CONNECT YOUR PHONE
          </h1>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '11px',
            fontWeight: 800,
            color: 'var(--accent-primary)',
            background: 'var(--bg-surface)',
            border: '1.5px solid var(--border-default)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm, 2px)',
            letterSpacing: '0.04em',
          }}
        >
          HOTSPOT: Kiosk-Hotspot
        </div>
      </div>

      {/* Error Notice from Previous Attempt if any */}
      {errorMessage && (
        <div
          style={{
            background: 'rgba(255, 68, 68, 0.12)',
            border: '1.5px solid var(--status-error, #FF4444)',
            borderRadius: 'var(--radius-md, 4px)',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--status-error, #FF4444)', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}>
            ⚠️ {errorMessage}
          </div>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--status-idle, #00FF88)',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 800,
            }}
          >
            [HOTSPOT RESTORED]
          </span>
        </div>
      )}

      {/* 2. Dual Clean QR Columns (Vertically Centered, Symmetrical, High Contrast) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          width: '100%',
          flex: 1,
          alignItems: 'stretch',
          minHeight: 0,
          margin: '8px 0',
        }}
      >
        {/* Step 1: Wi-Fi Auto-Connect */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '2px solid var(--border-default)',
            borderRadius: 'var(--radius-lg, 6px)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            boxShadow: 'var(--shadow-paper)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '13px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '0.04em',
            }}
          >
            1. SCAN TO JOIN WI-FI
          </div>

          <div
            style={{
              background: '#FFFFFF',
              padding: '10px',
              borderRadius: 'var(--radius-md, 6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            }}
          >
            <QRCodeSVG value={wifiQrPayload} size={150} level="M" />
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            SSID: Kiosk-Hotspot (No Password)
          </div>
        </div>

        {/* Step 2: Open Portal */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '2px solid var(--border-default)',
            borderRadius: 'var(--radius-lg, 6px)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            boxShadow: 'var(--shadow-paper)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '13px',
              fontWeight: 800,
              color: 'var(--accent-primary)',
              letterSpacing: '0.04em',
            }}
          >
            2. SCAN TO OPEN SETUP
          </div>

          <div
            style={{
              background: '#FFFFFF',
              padding: '10px',
              borderRadius: 'var(--radius-md, 6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            }}
          >
            <QRCodeSVG value={portalUrl} size={150} level="M" />
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            URL: http://192.168.4.1:3000/setup
          </div>
        </div>
      </div>

      {/* 3. High-Contrast Bottom Navigation Buttons */}
      <div style={{ display: 'flex', gap: '14px', width: '100%', flexShrink: 0 }}>
        <Button
          variant="ghost"
          leftIcon={<ArrowLeft size={18} />}
          onClick={cancelMobileMode}
          style={{
            flex: 1,
            height: '50px',
            fontSize: '13px',
            fontWeight: 800,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.04em',
          }}
        >
          [ BACK TO MODES ]
        </Button>

        <Button
          variant="primary"
          rightIcon={<ArrowRight size={18} />}
          onClick={startScreenMode}
          style={{
            flex: 1.5,
            height: '50px',
            fontSize: '14px',
            fontWeight: 800,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.04em',
          }}
        >
          USE TOUCHSCREEN INSTEAD ➔
        </Button>
      </div>
    </div>
  );
};
