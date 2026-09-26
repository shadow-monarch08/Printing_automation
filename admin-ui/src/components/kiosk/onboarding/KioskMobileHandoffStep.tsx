// src/components/kiosk/onboarding/KioskMobileHandoffStep.tsx
import React from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Wifi, ExternalLink } from 'lucide-react';
import { Button } from '../../shared/Button';

export const KioskMobileHandoffStep: React.FC = () => {
  const { cancelMobileMode, startScreenMode, errorMessage } = useKioskStore();

  const wifiQrPayload = 'WIFI:S:Kiosk-Hotspot;T:nopass;;';
  const portalUrl = 'http://192.168.4.1:3000/setup';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '440px',
        padding: '12px 18px',
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        userSelect: 'none',
      }}
    >
      {/* 1. Header Strip */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10B981',
                boxShadow: '0 0 8px #10B981',
                display: 'inline-block',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '12px',
                fontWeight: 700,
                color: '#34D399',
                letterSpacing: '0.05em',
              }}
            >
              HOTSPOT_BROADCASTING // [Kiosk-Hotspot]
            </span>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              color: '#38BDF8',
              background: 'rgba(56, 189, 248, 0.12)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            PORTAL: 192.168.4.1:3000
          </div>
        </div>

        {/* Error Notice from Previous Attempt if any */}
        {errorMessage ? (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1.5px solid #EF4444',
              borderRadius: '6px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginTop: '2px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#FCA5A5', fontFamily: 'var(--font-mono, monospace)' }}>
              ⚠️ SETUP FAILED: {errorMessage}
            </div>
            <span
              style={{
                fontSize: '10px',
                color: '#34D399',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              [HOTSPOT RESTORED]
            </span>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94A3B8)', margin: '2px 0 0 0' }}>
            Scan the QR codes with your smartphone or connect to <strong>Kiosk-Hotspot</strong> manually.
          </div>
        )}
      </div>

      {/* 2. QR Codes Dual Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          width: '100%',
          flex: 1,
          alignItems: 'center',
          margin: '4px 0',
        }}
      >
        {/* Step 1: Wi-Fi Auto-Connect */}
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1.5px solid var(--border-default, #334155)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            height: '240px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              fontWeight: 700,
              color: '#38BDF8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Wifi size={14} /> 1. JOIN WI-FI HOTSPOT
          </div>

          <div
            style={{
              background: '#FFFFFF',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
            }}
          >
            <QRCodeSVG value={wifiQrPayload} size={118} level="M" />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>
              SSID: [Kiosk-Hotspot]
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary, #94A3B8)' }}>
              (No password required)
            </div>
          </div>
        </div>

        {/* Step 2: Open Portal */}
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1.5px solid var(--border-default, #334155)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            height: '240px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              fontWeight: 700,
              color: '#34D399',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ExternalLink size={14} /> 2. OPEN SETUP PORTAL
          </div>

          <div
            style={{
              background: '#FFFFFF',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
            }}
          >
            <QRCodeSVG value={portalUrl} size={118} level="M" />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>
              http://192.168.4.1:3000
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary, #94A3B8)' }}>
              Browser setup will guide you through Wi-Fi
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Control Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          paddingTop: '6px',
          borderTop: '1px dashed var(--border-default, #334155)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#F59E0B',
              animation: 'pulse 1.2s infinite',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              color: 'var(--text-secondary, #94A3B8)',
            }}
          >
            Awaiting phone connection...
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="ghost"
            leftIcon={<ArrowLeft size={14} />}
            onClick={cancelMobileMode}
            style={{ height: '38px', padding: '0 14px', fontSize: '12px', fontWeight: 600 }}
          >
            Back to Mode Choice
          </Button>

          <Button
            variant="primary"
            onClick={startScreenMode}
            style={{ height: '38px', padding: '0 16px', fontSize: '12px', fontWeight: 700 }}
          >
            Switch to On-Screen Setup ➔
          </Button>
        </div>
      </div>
    </div>
  );
};
