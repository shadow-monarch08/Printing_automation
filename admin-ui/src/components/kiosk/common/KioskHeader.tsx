// src/components/kiosk/common/KioskHeader.tsx
import React from 'react';

interface KioskHeaderProps {
  shopName: string;
  isOnboarded: boolean;
  isProvisioning?: boolean;
  stepIndicator?: string;
}

export const KioskHeader: React.FC<KioskHeaderProps> = ({
  shopName,
  isOnboarded,
  stepIndicator,
}) => {
  return (
    <header
      style={{
        height: '36px',
        background: '#1A1D20',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxSizing: 'border-box',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Left: Shop Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isOnboarded ? '#10B981' : '#FF5500',
            boxShadow: isOnboarded ? '0 0 6px #10B981' : '0 0 6px #FF5500',
          }}
        />
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#E6E8EA',
            fontFamily: 'var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
          }}
        >
          {shopName || 'Print Kiosk'}
        </span>
      </div>

      {/* Right: Clean Step or Status Pill */}
      {stepIndicator ? (
        <div
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.7)',
            fontFamily: 'var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
            background: 'rgba(255, 255, 255, 0.06)',
            padding: '3px 10px',
            borderRadius: '12px',
          }}
        >
          {stepIndicator}
        </div>
      ) : (
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#10B981',
            background: 'rgba(16, 185, 129, 0.1)',
            padding: '3px 8px',
            borderRadius: '10px',
          }}
        >
          ONLINE
        </div>
      )}
    </header>
  );
};
