// src/components/kiosk/onboarding/KioskModeChoiceStep.tsx
import React from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { Smartphone, Monitor, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '../../shared/Button';

export const KioskModeChoiceStep: React.FC = () => {
  const { startMobileMode, startScreenMode, isHotspotStarting, errorMessage, setErrorMessage } = useKioskStore();

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 20px',
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* 1. Big Punchy Header Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          flexShrink: 0,
          marginBottom: '10px',
        }}
      >
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
          CHOOSE SETUP METHOD
        </h1>

        <span
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
          [INITIAL_CONFIG]
        </span>
      </div>

      {/* Error Notice Banner if any */}
      {errorMessage && (
        <div
          style={{
            background: 'rgba(255, 68, 68, 0.12)',
            border: '1.5px solid var(--status-error, #FF4444)',
            borderRadius: 'var(--radius-md, 4px)',
            padding: '8px 14px',
            color: 'var(--status-error, #FF4444)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            marginBottom: '10px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>{errorMessage}</span>
          </div>
          <Button variant="ghost" onClick={() => setErrorMessage(null)} style={{ height: '30px', fontSize: '11px', padding: '0 10px' }}>
            DISMISS
          </Button>
        </div>
      )}

      {/* 2. Dual Massive Interactive Tiles (Centered, Symmetrical, Ergonomic) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          width: '100%',
          flex: 1,
          alignItems: 'stretch',
          minHeight: 0,
        }}
      >
        {/* Tile A: Phone / Laptop */}
        <div
          onClick={startMobileMode}
          style={{
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            border: '2px solid var(--border-default)',
            borderRadius: 'var(--radius-lg, 6px)',
            padding: '16px 20px',
            cursor: 'none',
            position: 'relative',
            boxShadow: 'var(--shadow-paper)',
            transition: 'border-color 0.15s ease, transform 0.1s ease',
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        >
          {/* Card Top: Mode Tag */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--accent-primary)',
                background: 'var(--bg-primary)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm, 2px)',
                border: '1px solid var(--border-default)',
                letterSpacing: '0.04em',
              }}
            >
              [ WIRELESS HOTSPOT ]
            </span>
          </div>

          {/* Centered Graphic + Title Section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '6px',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                background: 'var(--bg-primary)',
                border: '1.5px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-paper)',
              }}
            >
              <Smartphone size={34} color="var(--accent-primary)" />
            </div>

            <div
              style={{
                fontSize: '21px',
                fontWeight: 900,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                marginTop: '4px',
              }}
            >
              Phone / Laptop
            </div>

            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.04em',
              }}
            >
              CONNECT VIA MOBILE BROWSER
            </div>
          </div>

          {/* Full-Width Action Button */}
          <Button
            variant="primary"
            isLoading={isHotspotStarting}
            rightIcon={<ArrowRight size={18} />}
            style={{
              width: '100%',
              height: '52px',
              fontSize: '14px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-mono, monospace)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              startMobileMode();
            }}
          >
            USE PHONE / LAPTOP
          </Button>
        </div>

        {/* Tile B: On-Screen Touch */}
        <div
          onClick={startScreenMode}
          style={{
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            border: '2px solid var(--border-default)',
            borderRadius: 'var(--radius-lg, 6px)',
            padding: '16px 20px',
            cursor: 'none',
            position: 'relative',
            boxShadow: 'var(--shadow-paper)',
            transition: 'border-color 0.15s ease, transform 0.1s ease',
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        >
          {/* Card Top: Mode Tag */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                background: 'var(--bg-primary)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm, 2px)',
                border: '1px solid var(--border-default)',
                letterSpacing: '0.04em',
              }}
            >
              [ CHASSIS DISPLAY ]
            </span>
          </div>

          {/* Centered Graphic + Title Section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '6px',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                background: 'var(--bg-primary)',
                border: '1.5px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-paper)',
              }}
            >
              <Monitor size={34} color="var(--text-primary)" />
            </div>

            <div
              style={{
                fontSize: '21px',
                fontWeight: 900,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                marginTop: '4px',
              }}
            >
              Touchscreen
            </div>

            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.04em',
              }}
            >
              CONFIGURE DIRECTLY ON DISPLAY
            </div>
          </div>

          {/* Full-Width Action Button */}
          <Button
            variant="mechanical"
            rightIcon={<ArrowRight size={18} />}
            style={{
              width: '100%',
              height: '52px',
              fontSize: '14px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-mono, monospace)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              startScreenMode();
            }}
          >
            CONFIGURE ON SCREEN
          </Button>
        </div>
      </div>
    </div>
  );
};
