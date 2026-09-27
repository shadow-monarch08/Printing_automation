// src/components/kiosk/telemetry/KioskOperationalHUD.tsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Wifi, Printer } from 'lucide-react';
import { SkeletonBox } from '../../shared/SkeletonPrimitives';
import type { KioskSummaryData } from '../../../types';

interface KioskOperationalHUDProps {
  summary: KioskSummaryData | null;
  onRefresh?: () => void;
}

export const KioskOperationalHUD: React.FC<KioskOperationalHUDProps> = ({ summary }) => {
  const isOnline = summary?.internetOnline ?? false;
  const cloudflareUrl = summary?.cloudflareUrl;
  const localUrl = summary?.localAccessUrl || 'http://piprint.local:3000/';
  const liveQrTarget = isOnline && cloudflareUrl ? cloudflareUrl : localUrl;

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* 1. CENTER STAGE: GIANT HERO CUSTOMER QR CODE */}
      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
          padding: '16px',
          boxSizing: 'border-box',
        }}
      >
        {!summary ? (
          <>
            <div
              style={{
                width: '256px',
                height: '256px',
                background: '#FFFFFF',
                padding: '16px',
                borderRadius: 'var(--radius-lg, 8px)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
                border: '2px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <SkeletonBox width="224px" height="224px" borderRadius="4px" />
            </div>
            <SkeletonBox width="240px" height="28px" borderRadius="4px" style={{ marginTop: '12px' }} />
          </>
        ) : (
          <>
            {/* Dimensionally Fixed QR Card - Prevents layout shifts between local and cloudflare URLs */}
            <div
              style={{
                width: '256px',
                height: '256px',
                background: '#FFFFFF',
                padding: '16px',
                borderRadius: 'var(--radius-lg, 8px)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
                border: '2px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <QRCodeSVG value={liveQrTarget} size={224} level="M" includeMargin={false} />
            </div>

            {/* Instruction Tag Badge */}
            <div
              style={{
                marginTop: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm, 4px)',
                background: isOnline ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 85, 0, 0.12)',
                border: `1.5px solid ${isOnline ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)'}`,
                color: isOnline ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)',
                boxSizing: 'border-box',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isOnline ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)',
                  boxShadow: `0 0 8px ${isOnline ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)'}`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  fontFamily: 'var(--font-mono, monospace)',
                  whiteSpace: 'nowrap',
                }}
              >
                {isOnline ? 'POINT CAMERA TO UPLOAD & PRINT' : 'POINT CAMERA TO PRINT (LOCAL)'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* 2. DOCKED EDGE-TO-EDGE HARDWARE FOOTER: SPREAD TELEMETRY */}
      {!summary ? (
        <footer
          style={{
            width: '100%',
            height: '46px',
            background: 'var(--bg-surface)',
            borderTop: '1.5px solid var(--border-default)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SkeletonBox width="16px" height="16px" borderRadius="3px" />
            <SkeletonBox width="120px" height="16px" borderRadius="3px" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SkeletonBox width="16px" height="16px" borderRadius="3px" />
            <SkeletonBox width="120px" height="16px" borderRadius="3px" />
          </div>
        </footer>
      ) : (
        <footer
          style={{
            width: '100%',
            height: '46px',
            background: 'var(--bg-surface)',
            borderTop: '1.5px solid var(--border-default)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            flexShrink: 0,
          }}
        >
          {/* Compressed Telemetry Left: Network */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
              maxWidth: '380px',
            }}
          >
            <Wifi size={16} color="var(--accent-primary, #FF5500)" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              NET:
            </span>
            <span
              title={summary.activeProfile || 'ETHERNET'}
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono, monospace)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {summary.activeProfile || 'ETHERNET'}
            </span>
          </div>

          {/* Compressed Telemetry Right: Fleet Printers */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <Printer size={16} color="var(--status-idle, #00FF88)" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.02em',
              }}
            >
              {summary.printerCount || 0} {summary.printerCount === 1 ? 'PRINTER' : 'PRINTERS'} READY
            </span>
          </div>
        </footer>
      )}
    </div>
  );
};

