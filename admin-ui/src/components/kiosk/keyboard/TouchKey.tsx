// src/components/kiosk/keyboard/TouchKey.tsx
import React from 'react';

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
  height = '48px',
  disabled = false,
  style = {},
}) => {
  const getColors = () => {
    switch (variant) {
      case 'accent':
        return {
          bg: 'var(--accent-primary, #FF5500)',
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
          bg: '#202327',
          color: 'var(--text-secondary, #9098A2)',
          border: 'var(--border-default, #3A4047)',
          shadow: '0 3px 0 #000000',
        };
      case 'default':
      default:
        return {
          bg: 'var(--bg-surface, #24282D)',
          color: 'var(--text-primary, #E6E8EA)',
          border: 'var(--border-default, #3A4047)',
          shadow: '0 3px 0 #000000',
        };
    }
  };

  const colors = getColors();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onClick();
      }}
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
        borderRadius: 'var(--radius-sm, 4px)',
        boxShadow: colors.shadow,
        fontSize: '16px',
        fontWeight: 700,
        fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
        cursor: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
        opacity: disabled ? 0.4 : 1,
        transition: 'transform 0.06s ease, filter 0.06s ease',
        boxSizing: 'border-box',
        padding: '0 4px',
        ...style,
      }}
      onPointerDown={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(2px)';
          e.currentTarget.style.filter = 'brightness(1.15)';
        }
      }}
      onPointerUp={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.filter = 'none';
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.filter = 'none';
      }}
    >
      {label}
    </button>
  );
};
