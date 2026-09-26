// src/components/kiosk/onboarding/KioskModeChoiceStep.tsx
import React from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { Smartphone, Monitor, Sparkles, Touchpad, Loader2 } from 'lucide-react';

export const KioskModeChoiceStep: React.FC = () => {
  const { startMobileMode, startScreenMode, isHotspotStarting, errorMessage } = useKioskStore();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '440px',
        padding: '16px 20px',
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
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '12px',
                fontWeight: 700,
                color: '#38BDF8',
                letterSpacing: '0.05em',
              }}
            >
              SYSTEM_PROVISIONING // CONFIGURATION_MODE
            </span>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              color: 'var(--text-secondary, #94A3B8)',
            }}
          >
            [SELECT PREFERRED METHOD]
          </div>
        </div>

        <p
          style={{
            margin: '2px 0 0 0',
            fontSize: '13px',
            color: 'var(--text-secondary, #94A3B8)',
            lineHeight: 1.4,
          }}
        >
          Select how you would like to configure this kiosk terminal.
        </p>
      </div>

      {/* Error Notice if any */}
      {errorMessage && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #EF4444',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#FCA5A5',
            fontSize: '12px',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* 2. Dual Selection Cards Container */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          width: '100%',
          flex: 1,
          maxHeight: '330px',
          alignItems: 'stretch',
          margin: '8px 0',
        }}
      >
        {/* Card A: Phone / Laptop */}
        <button
          type="button"
          onClick={startMobileMode}
          disabled={isHotspotStarting}
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '2px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '10px',
            padding: '16px 18px',
            cursor: 'pointer',
            position: 'relative',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
            transition: 'transform 0.15s ease, border-color 0.15s ease',
          }}
          onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {/* Top Tag */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '10px',
                fontWeight: 700,
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.15)',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Sparkles size={11} /> RECOMMENDED
            </span>
            <Smartphone size={28} color="#38BDF8" />
          </div>

          {/* Body Content */}
          <div style={{ margin: '8px 0' }}>
            <div
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
                marginBottom: '4px',
              }}
            >
              Phone / Laptop
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary, #94A3B8)',
                lineHeight: 1.45,
              }}
            >
              Broadcasts a Wi-Fi hotspot. Connect your device to type smoothly on your mobile screen.
            </div>
          </div>

          {/* Action Button Footer */}
          <div
            style={{
              width: '100%',
              background: '#0284C7',
              color: '#FFFFFF',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '12px',
              fontWeight: 700,
              padding: '10px 0',
              borderRadius: '6px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
            }}
          >
            {isHotspotStarting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> STARTING HOTSPOT...
              </>
            ) : (
              'USE PHONE / LAPTOP ➔'
            )}
          </div>
        </button>

        {/* Card B: On-Screen Touch */}
        <button
          type="button"
          onClick={startScreenMode}
          disabled={isHotspotStarting}
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '2px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '10px',
            padding: '16px 18px',
            cursor: 'pointer',
            position: 'relative',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
            transition: 'transform 0.15s ease, border-color 0.15s ease',
          }}
          onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {/* Top Tag */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '10px',
                fontWeight: 700,
                color: '#34D399',
                background: 'rgba(16, 185, 129, 0.15)',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Touchpad size={11} /> DIRECT CHASSIS
            </span>
            <Monitor size={28} color="#34D399" />
          </div>

          {/* Body Content */}
          <div style={{ margin: '8px 0' }}>
            <div
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
                marginBottom: '4px',
              }}
            >
              Touchscreen Display
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary, #94A3B8)',
                lineHeight: 1.45,
              }}
            >
              Configure shop identity and connect Wi-Fi directly using this physical 5-inch touchscreen.
            </div>
          </div>

          {/* Action Button Footer */}
          <div
            style={{
              width: '100%',
              background: '#059669',
              color: '#FFFFFF',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '12px',
              fontWeight: 700,
              padding: '10px 0',
              borderRadius: '6px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.4)',
            }}
          >
            CONFIGURE ON SCREEN ➔
          </div>
        </button>
      </div>

      {/* 3. Footer Telemetry Note */}
      <div
        style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '11px',
          color: 'var(--text-secondary, #64748B)',
          textAlign: 'center',
        }}
      >
        You can switch between mobile and on-screen setup at any time during onboarding.
      </div>
    </div>
  );
};
