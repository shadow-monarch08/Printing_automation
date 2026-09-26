// src/components/kiosk/keyboard/TouchKey.tsx
import React, { useRef } from 'react';

interface TouchKeyProps {
  label: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'action' | 'danger' | 'accent' | 'secondary';
  flex?: number | string;
  minWidth?: string;
  height?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const TouchKey: React.FC<TouchKeyProps> = ({
  label,
  onClick,
  variant = 'default',
  flex = 1,
  minWidth = '48px',
  height = '56px',
  disabled = false,
  style = {},
}) => {
  const lastFiredRef = useRef<number>(0);

  const triggerAction = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    // Debounce 120ms to prevent double-fires from resistive touch micro-bounces
    const now = Date.now();
    if (now - lastFiredRef.current < 120) return;
    lastFiredRef.current = now;

    onClick();
  };

  const getColors = () => {
    switch (variant) {
      case 'accent':
        return {
          bg: '#FF5500',
          color: '#1A1D20',
          border: '#E04B00',
          shadow: '0 3px 0 #000000',
        };
      case 'action':
        return {
          bg: '#10B981',
          color: '#0D1117',
          border: '#059669',
          shadow: '0 3px 0 #000000',
        };
      case 'danger':
        return {
          bg: '#EF4444',
          color: '#FFFFFF',
          border: '#DC2626',
          shadow: '0 3px 0 #7F1D1D',
        };
      case 'secondary':
        return {
          bg: '#24282D',
          color: '#E6E8EA',
          border: 'rgba(255, 255, 255, 0.15)',
          shadow: '0 3px 0 #000000',
        };
      case 'default':
      default:
        return {
          bg: '#2D3238',
          color: '#FFFFFF',
          border: 'rgba(255, 255, 255, 0.12)',
          shadow: '0 3px 0 #000000',
        };
    }
  };

  const colors = getColors();

  return (
    <button
      type="button"
      onPointerDown={triggerAction}
      disabled={disabled}
      style={{
        flex,
        minWidth,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bg,
        color: colors.color,
        border: `1.5px solid ${colors.border}`,
        borderRadius: '6px',
        boxShadow: colors.shadow,
        fontSize: '18px',
        fontWeight: 700,
        fontFamily: 'var(--font-mono, monospace)',
        cursor: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        opacity: disabled ? 0.35 : 1,
        boxSizing: 'border-box',
        padding: '0 4px',
        ...style,
      }}
      onPointerUp={(e) => {
        e.currentTarget.style.transform = 'none';
      }}
    >
      {label}
    </button>
  );
};
