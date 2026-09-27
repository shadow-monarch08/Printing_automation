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
      {/* 1. Big Punchy Header Strip (No subtitles) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '24px',
            fontWeight: 800,
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
            fontWeight: 700,
            color: 'var(--accent-primary)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm, 2px)',
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
            fontSize: '13px',
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
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

      {/* 2. Dual Massive Interactive Tiles (1:1 Grid) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          width: '100%',
          flex: 1,
          maxHeight: '340px',
          alignItems: 'stretch',
          margin: '10px 0',
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
            background: 'var(--bg-surface)',
            border: '2px solid var(--border-default)',
            borderRadius: 'var(--radius-lg, 6px)',
            padding: '20px 22px',
            cursor: 'none',
            position: 'relative',
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
          {/* Card Top: Icon & Mode Tag */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Smartphone size={40} color="var(--accent-primary)" />
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--accent-primary)',
                background: 'var(--bg-primary)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm, 2px)',
                border: '1px solid var(--border-default)',
              }}
            >
              [HOTSPOT_AP]
            </span>
          </div>

          {/* Big Title */}
          <div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '-0.02em',
              }}
            >
              Phone / Laptop
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono, monospace)',
                marginTop: '4px',
              }}
            >
              CONFIGURE VIA MOBILE BROWSER
            </div>
          </div>

          {/* Huge Action Button */}
          <Button
            variant="primary"
            isLoading={isHotspotStarting}
            rightIcon={<ArrowRight size={18} />}
            style={{ width: '100%', height: '54px', fontSize: '15px', fontWeight: 800 }}
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
            background: 'var(--bg-surface)',
            border: '2px solid var(--border-default)',
            borderRadius: 'var(--radius-lg, 6px)',
            padding: '20px 22px',
            cursor: 'none',
            position: 'relative',
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
          {/* Card Top: Icon & Mode Tag */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Monitor size={40} color="var(--text-primary)" />
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                background: 'var(--bg-primary)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm, 2px)',
                border: '1px solid var(--border-default)',
              }}
            >
              [CHASSIS_TOUCH]
            </span>
          </div>

          {/* Big Title */}
          <div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '-0.02em',
              }}
            >
              Touchscreen
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono, monospace)',
                marginTop: '4px',
              }}
            >
              CONFIGURE DIRECTLY ON DISPLAY
            </div>
          </div>

          {/* Huge Action Button */}
          <Button
            variant="mechanical"
            rightIcon={<ArrowRight size={18} />}
            style={{ width: '100%', height: '54px', fontSize: '15px', fontWeight: 800 }}
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
