// src/components/kiosk/common/KioskHeader.tsx
import React from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { Button } from '../../shared/Button';
import { Sun, Moon } from 'lucide-react';

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
  const { kioskTheme, toggleKioskTheme } = useKioskStore();

  return (
    <header
      style={{
        height: '52px',
        background: 'var(--bg-surface)',
        borderBottom: '2px solid var(--border-default)',
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
      {/* Left: Hardware Status Diode + Shop Identifier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: isOnboarded ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)',
            boxShadow: isOnboarded
              ? '0 0 12px var(--status-idle, #00FF88)'
              : '0 0 12px var(--accent-primary, #FF5500)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: '15px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {shopName || 'PRINT KIOSK CHASSIS'}
        </span>
      </div>

      {/* Right: Step Indicator + Prominent Ergonomic Theme Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {stepIndicator ? (
          <div
            style={{
              fontSize: '12px',
              fontWeight: 800,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono, monospace)',
              background: 'var(--bg-primary)',
              border: '1.5px solid var(--border-default)',
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm, 2px)',
              letterSpacing: '0.05em',
            }}
          >
            {stepIndicator.toUpperCase()}
          </div>
        ) : (
          <div
            style={{
              fontSize: '12px',
              fontWeight: 800,
              color: 'var(--status-idle, #00FF88)',
              background: 'var(--bg-primary)',
              border: '1.5px solid var(--border-default)',
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm, 2px)',
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.05em',
            }}
          >
            ONLINE
          </div>
        )}

        {/* Dedicated Tactile Theme Switcher (38px Touch Target, Zero Overflow, High-Contrast Icons) */}
        <Button
          variant="ghost"
          leftIcon={
            kioskTheme === 'dark' ? (
              <Sun
                size={18}
                color="#FBBF24"
                style={{
                  filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.8))',
                  flexShrink: 0,
                }}
              />
            ) : (
              <Moon
                size={18}
                color="#D03B00"
                style={{
                  filter: 'drop-shadow(0 0 4px rgba(208, 59, 0, 0.5))',
                  flexShrink: 0,
                }}
              />
            )
          }
          onClick={toggleKioskTheme}
          style={{
            height: '38px',
            padding: '0 16px',
            fontSize: '12px',
            fontWeight: 800,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.06em',
            borderRadius: 'var(--radius-sm, 4px)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '2px solid var(--border-default)',
            boxShadow: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
          title={`Switch to ${kioskTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {kioskTheme === 'dark' ? 'LIGHT' : 'DARK'}
        </Button>
      </div>
    </header>
  );
};
