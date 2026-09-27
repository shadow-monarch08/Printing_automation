// src/components/kiosk/telemetry/KioskOperationalHUD.tsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Globe, Wifi, Printer, RefreshCw } from 'lucide-react';
import { Button } from '../../shared/Button';
import { SkeletonBox } from '../../shared/SkeletonPrimitives';
import type { KioskSummaryData } from '../../../types';

interface KioskOperationalHUDProps {
  summary: KioskSummaryData | null;
  onRefresh: () => void;
}

export const KioskOperationalHUD: React.FC<KioskOperationalHUDProps> = ({ summary, onRefresh }) => {
  const isOnline = summary?.internetOnline ?? false;
  const cloudflareUrl = summary?.cloudflareUrl;
  const localUrl = summary?.localAccessUrl || 'http://127.0.0.1:3000';
  const liveQrTarget = isOnline && cloudflareUrl ? cloudflareUrl : localUrl;

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        padding: '16px',
        gap: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. LEFT COLUMN: GIANT CUSTOMER QR CODE (Width: 320px) */}
      <div
        style={{
          width: '320px',
          background: 'var(--bg-surface)',
          border: '1.5px solid var(--border-default)',
          borderRadius: 'var(--radius-lg, 6px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          boxSizing: 'border-box',
          boxShadow: 'var(--shadow-paper)',
        }}
      >
        {!summary ? (
          <>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SkeletonBox width="210px" height="210px" borderRadius="6px" />
            </div>
            <SkeletonBox width="100%" height="38px" borderRadius="4px" />
          </>
        ) : (
          <>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '14px',
                  borderRadius: 'var(--radius-md, 6px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <QRCodeSVG value={liveQrTarget} size={200} level="M" includeMargin={false} />
              </div>
            </div>

            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm, 3px)',
                background: isOnline ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 85, 0, 0.12)',
                border: `1.5px solid ${isOnline ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)'}`,
                color: isOnline ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)',
                textAlign: 'center',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-mono, monospace)',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {isOnline ? '● SCAN TO UPLOAD & PRINT' : '▲ LOCAL WI-FI PRINTING ONLY'}
            </div>
          </>
        )}
      </div>

      {/* 2. RIGHT COLUMN: MACHINE TELEMETRY */}
      <div
        style={{
          flex: 1,
          background: 'var(--bg-surface)',
          border: '1.5px solid var(--border-default)',
          borderRadius: 'var(--radius-lg, 6px)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          boxShadow: 'var(--shadow-paper)',
        }}
      >
        {!summary ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
              <SkeletonBox width="50%" height="24px" borderRadius="4px" />
              <SkeletonBox width="70px" height="20px" borderRadius="2px" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SkeletonBox width="100%" height="54px" borderRadius="6px" />
              <SkeletonBox width="100%" height="54px" borderRadius="6px" />
              <SkeletonBox width="100%" height="54px" borderRadius="6px" />
            </div>
            <SkeletonBox width="100%" height="48px" borderRadius="4px" />
          </>
        ) : (
          <>
            {/* Header: Shop Title + Live Diode */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: isOnline ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)',
                    boxShadow: `0 0 10px ${isOnline ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)'}`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: '19px',
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    letterSpacing: '0.04em',
                    fontFamily: 'var(--font-mono, monospace)',
                    textTransform: 'uppercase',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '260px',
                  }}
                >
                  {summary.shopName || 'SYSTEM READY'}
                </span>
              </div>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.06em',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm, 2px)',
                  background: isOnline ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 85, 0, 0.12)',
                  border: `1px solid ${isOnline ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)'}`,
                  color: isOnline ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)',
                  flexShrink: 0,
                }}
              >
                {isOnline ? 'ONLINE' : 'STANDALONE'}
              </span>
            </div>

            {/* Telemetry Metric Plates */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Active Network Plate */}
              <div
                style={{
                  background: 'var(--bg-primary)',
                  border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-md, 6px)',
                  padding: '9px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Wifi size={18} color="var(--accent-primary)" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    ACTIVE NETWORK
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono, monospace)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {summary.activeProfile || 'WIRED ETHERNET / WLAN0'}
                  </div>
                </div>
              </div>

              {/* Fleet Engines Plate */}
              <div
                style={{
                  background: 'var(--bg-primary)',
                  border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-md, 6px)',
                  padding: '9px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Printer size={18} color="var(--status-idle, #00FF88)" />
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                      FLEET ENGINES
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono, monospace)',
                      }}
                    >
                      {summary.printerCount} CUPS PRINTER(S) ONLINE
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '2px',
                    background: 'rgba(0, 255, 136, 0.1)',
                    border: '1px solid var(--status-idle, #00FF88)',
                    color: 'var(--status-idle, #00FF88)',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  READY
                </span>
              </div>

              {/* Access Portal Plate */}
              <div
                style={{
                  background: 'var(--bg-primary)',
                  border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-md, 6px)',
                  padding: '9px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Globe size={18} color="var(--accent-secondary, #00A396)" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    ACCESS PORTAL
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono, monospace)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isOnline && cloudflareUrl ? cloudflareUrl : (summary.localAccessUrl || 'http://127.0.0.1:3000')}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Primitive Action Button */}
            <Button
              variant="mechanical"
              onClick={onRefresh}
              leftIcon={<RefreshCw size={18} />}
              style={{
                width: '100%',
                height: '48px',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              REFRESH TELEMETRY
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
