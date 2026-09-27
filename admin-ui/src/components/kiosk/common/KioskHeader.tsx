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
        height: '46px',
        background: 'var(--bg-surface)',
        borderBottom: '1.5px solid var(--border-default)',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: isOnboarded ? 'var(--status-idle, #00FF88)' : 'var(--accent-primary, #FF5500)',
            boxShadow: isOnboarded
              ? '0 0 10px var(--status-idle, #00FF88)'
              : '0 0 10px var(--accent-primary, #FF5500)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: '13px',
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
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono, monospace)',
              background: 'var(--bg-primary)',
              border: '1.5px solid var(--border-default)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm, 2px)',
              letterSpacing: '0.05em',
            }}
          >
            {stepIndicator.toUpperCase()}
          </div>
        ) : (
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--status-idle, #00FF88)',
              background: 'var(--bg-primary)',
              border: '1.5px solid var(--border-default)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm, 2px)',
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.05em',
            }}
          >
            ONLINE
          </div>
        )}

        {/* Large Tactile Theme Switcher (36px Touch Target, Big Visible Icon & Text) */}
        <Button
          variant="mechanical"
          leftIcon={
            kioskTheme === 'dark' ? (
              <Sun size={17} color="#FFAA00" />
            ) : (
              <Moon size={17} color="var(--accent-primary)" />
            )
          }
          onClick={toggleKioskTheme}
          style={{
            height: '36px',
            padding: '0 14px',
            fontSize: '12px',
            fontWeight: 800,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.06em',
            borderRadius: 'var(--radius-md, 4px)',
          }}
          title={`Switch to ${kioskTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {kioskTheme === 'dark' ? 'LIGHT' : 'DARK'}
        </Button>
      </div>
    </header>
  );
};
