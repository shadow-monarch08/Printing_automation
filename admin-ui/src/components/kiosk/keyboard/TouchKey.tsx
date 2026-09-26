// src/components/kiosk/keyboard/TouchKey.tsx
import React, { useRef, useState, useCallback } from 'react';

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
  minWidth = '36px',
  height = '52px',
  disabled = false,
  style = {},
}) => {
  const lastFiredRef = useRef<number>(0);
  const [isPressed, setIsPressed] = useState(false);

  const triggerAction = useCallback(
    (e: React.SyntheticEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();

      // Debounce rapid duplicate events (pointerdown -> touchstart -> click)
      const now = Date.now();
      if (now - lastFiredRef.current < 110) return;
      lastFiredRef.current = now;

      // Visual tactile flash
      setIsPressed(true);
      setTimeout(() => setIsPressed(false), 120);

      if (!disabled) {
        onClick();
      }
    },
    [disabled, onClick]
  );

  const getColors = () => {
    if (isPressed) {
      return {
        bg: '#FFFFFF',
        color: '#000000',
        border: '#FFFFFF',
        shadow: 'none',
      };
    }

    switch (variant) {
      case 'accent':
        return {
          bg: '#FF5500',
          color: '#1A1D20',
          border: '#FF7733',
          shadow: '0 3px 0 #992200',
        };
      case 'action':
        return {
          bg: '#10B981',
          color: '#0D1117',
          border: '#34D399',
          shadow: '0 3px 0 #065F46',
        };
      case 'danger':
        return {
          bg: '#EF4444',
          color: '#FFFFFF',
          border: '#F87171',
          shadow: '0 3px 0 #991B1B',
        };
      case 'secondary':
        return {
          bg: '#2A2E34',
          color: '#E6E8EA',
          border: 'rgba(255, 255, 255, 0.22)',
          shadow: '0 3px 0 #111315',
        };
      case 'default':
      default:
        return {
          bg: '#202428',
          color: '#FFFFFF',
          border: 'rgba(255, 255, 255, 0.16)',
          shadow: '0 3px 0 #0E1012',
        };
    }
  };

  const colors = getColors();

  return (
    <button
      type="button"
      onPointerDown={triggerAction}
      onTouchStart={triggerAction}
      onClick={triggerAction}
      aria-disabled={disabled}
      style={{
        flex,
        minWidth,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bg,
        color: colors.color,
        border: `2px solid ${colors.border}`,
        borderRadius: '8px',
        boxShadow: colors.shadow,
        fontSize: '18px',
        fontWeight: 700,
        fontFamily: 'var(--font-mono, monospace)',
        cursor: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        opacity: disabled ? 0.4 : 1,
        transform: isPressed ? 'translateY(2px)' : 'none',
        transition: 'transform 0.04s ease, background 0.04s ease',
        boxSizing: 'border-box',
        padding: '0 4px',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <span
        style={{
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
    </button>
  );
};
