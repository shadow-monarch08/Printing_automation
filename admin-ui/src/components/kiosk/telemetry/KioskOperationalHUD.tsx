// src/components/kiosk/telemetry/KioskOperationalHUD.tsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Globe, Wifi, Printer, Shield, RefreshCw } from 'lucide-react';
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
        display: 'flex',
        overflow: 'hidden',
        padding: '16px',
        gap: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. LEFT COLUMN: GIANT CUSTOMER QR CODE (Width: 340px) */}
      <div
        style={{
          width: '340px',
          background: 'var(--bg-surface, #24282D)',
          border: '2px solid var(--border-default, #3A4047)',
          borderRadius: 'var(--radius-lg, 8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px',
          gap: '12px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            padding: '14px',
            borderRadius: 'var(--radius-lg, 8px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <QRCodeSVG value={liveQrTarget} size={210} level="H" includeMargin={false} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: 'var(--radius-sm, 4px)',
              background: isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              border: `1px solid ${isOnline ? '#10B981' : '#F59E0B'}`,
              color: isOnline ? '#10B981' : '#F59E0B',
              display: 'inline-block',
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {isOnline ? '[ SCAN TO PRINT // CUSTOMER ACCESS ]' : '[ LOCAL WI-FI PRINTING ACTIVE ]'}
          </div>
        </div>
      </div>

      {/* 2. RIGHT COLUMN: MACHINE TELEMETRY */}
      <div
        style={{
          flex: 1,
          background: 'var(--bg-surface, #24282D)',
          border: '2px solid var(--border-default, #3A4047)',
          borderRadius: 'var(--radius-lg, 8px)',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}
      >
        {/* Telemetry Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Edge Status */}
          <div
            style={{
              background: 'var(--bg-primary, #1A1D20)',
              border: '1px solid var(--border-default, #3A4047)',
              borderRadius: 'var(--radius-md, 6px)',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Globe size={16} color="var(--accent-primary, #FF5500)" />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                EDGE TUNNEL ROUTING
              </span>
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: isOnline && cloudflareUrl ? '#10B981' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                wordBreak: 'break-all',
              }}
            >
              {isOnline && cloudflareUrl ? cloudflareUrl : 'DIRECT_LAN_FALLBACK_ACTIVE'}
            </div>
          </div>

          {/* Wi-Fi Link Details */}
          <div
            style={{
              background: 'var(--bg-primary, #1A1D20)',
              border: '1px solid var(--border-default, #3A4047)',
              borderRadius: 'var(--radius-md, 6px)',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Wifi size={16} color="var(--accent-secondary, #00A396)" />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ACTIVE NETWORK LINK
              </span>
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {summary?.activeProfile || 'WIRED_ETHERNET / WLAN0'}
            </div>
          </div>

          {/* Printer Fleet Stats */}
          <div
            style={{
              background: 'var(--bg-primary, #1A1D20)',
              border: '1px solid var(--border-default, #3A4047)',
              borderRadius: 'var(--radius-md, 6px)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={16} color="#10B981" />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  FLEET ENGINES
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#10B981',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {summary?.printerCount || 0} CUPS PRINTER(S) ONLINE
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '4px 8px',
                borderRadius: '2px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10B981',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#10B981',
                fontWeight: 700,
              }}
            >
              ACCEPTING JOBS
            </div>
          </div>
        </div>

        {/* Bottom Hardware Diagnostics Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px dashed var(--border-default, #3A4047)',
            paddingTop: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            <Shield size={14} color="#10B981" />
            <span>LOCAL IP: {summary?.localAccessUrl?.replace('http://', '') || '127.0.0.1:3000'}</span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            style={{
              height: '32px',
              padding: '0 12px',
              background: 'var(--bg-primary, #1A1D20)',
              border: '1px solid var(--border-default, #3A4047)',
              borderRadius: '2px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'none',
            }}
          >
            <RefreshCw size={12} />
            <span>SYNC</span>
          </button>
        </div>
      </div>
    </div>
  );
};
