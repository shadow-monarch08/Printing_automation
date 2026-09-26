// src/components/kiosk/common/KioskHeader.tsx
import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface KioskHeaderProps {
  shopName: string;
  isOnboarded: boolean;
  isProvisioning?: boolean;
  isOnline?: boolean;
  stepIndicator?: string;
  ipAddress?: string | null;
}

export const KioskHeader: React.FC<KioskHeaderProps> = ({
  shopName,
  isOnboarded,
  isProvisioning = false,
  isOnline = false,
  stepIndicator,
  ipAddress,
}) => {
  const getLedClass = () => {
    if (isProvisioning) return 'amber';
    if (isOnboarded) return isOnline ? 'green' : 'amber';
    return 'amber';
  };

  const getModeLabel = () => {
    if (isProvisioning) return 'PROVISIONING';
    if (isOnboarded) return 'OPERATIONAL';
    return 'FIRST_BOOT';
  };

  return (
    <div
      style={{
        height: '40px',
        background: 'var(--bg-surface, #24282D)',
        borderBottom: '2px solid var(--border-default, #3A4047)',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxSizing: 'border-box',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Left: LED + Terminal Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          className={`led-diode ${getLedClass()}`}
          style={{ width: '10px', height: '10px', borderRadius: '50%' }}
        />
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-primary, #E6E8EA)',
          }}
        >
          PRINT_TERMINAL // [{shopName?.toUpperCase() || 'MODERN PRESS'}]
        </span>
      </div>

      {/* Center: Step Indicator (if in onboarding) */}
      {stepIndicator && (
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--accent-primary, #FF5500)',
            background: 'var(--bg-primary, #1A1D20)',
            padding: '2px 10px',
            borderRadius: '2px',
            border: '1px solid var(--border-default, #3A4047)',
          }}
        >
          {stepIndicator}
        </div>
      )}

      {/* Right: Hardware State & Telemetry */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--text-secondary, #9098A2)',
        }}
      >
        {ipAddress && <span>IP: {ipAddress}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isOnline ? <Wifi size={13} color="#10B981" /> : <WifiOff size={13} color="#F59E0B" />}
          <span>{isOnline ? 'ONLINE' : 'STATION'}</span>
        </div>
        <span
          style={{
            padding: '2px 6px',
            background: isOnboarded ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 85, 0, 0.15)',
            color: isOnboarded ? '#10B981' : '#FF5500',
            border: `1px solid ${isOnboarded ? '#059669' : '#FF5500'}`,
            borderRadius: '2px',
            fontWeight: 700,
          }}
        >
          MODE: {getModeLabel()}
        </span>
        <span>DISP: 800x480</span>
      </div>
    </div>
  );
};
