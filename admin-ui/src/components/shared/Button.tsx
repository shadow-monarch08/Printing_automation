import React, { useState, useRef, useEffect } from 'react';
import { soundFx } from '../../utils/sound';
import { LoadingNet } from './LoadingNet';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'mechanical' | 'danger' | 'ghost' | 'primary';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  debounceMs?: number;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'mechanical',
  isLoading: propIsLoading = false,
  disabled,
  className = '',
  leftIcon,
  rightIcon,
  debounceMs = 500,
  onClick,
  ...props
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const isCooldownRef = useRef(false);
  const cooldownTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current) {
        window.clearTimeout(cooldownTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent action if disabled or loading
    if (propIsLoading || internalLoading || disabled) {
      e.preventDefault();
      return;
    }

    // Play mechanical sound click effect
    soundFx.playClick();

    // Ignore clicks if within cooldown period
    if (isCooldownRef.current && debounceMs > 0) {
      e.preventDefault();
      return;
    }

    // Start cooldown
    if (debounceMs > 0) {
      isCooldownRef.current = true;
      cooldownTimeoutRef.current = window.setTimeout(() => {
        isCooldownRef.current = false;
      }, debounceMs);
    }

    if (onClick) {
      const result = onClick(e) as any;
      if (result instanceof Promise) {
        setInternalLoading(true);
        try {
          await result;
        } finally {
          setInternalLoading(false);
        }
      }
    }
  };

  const showLoading = propIsLoading || internalLoading;
  const btnClass = `btn-${variant} ${className}`.trim();

  return (
    <button 
      className={btnClass} 
      disabled={showLoading || disabled} 
      onClick={handleClick}
      {...props}
    >
      {showLoading && (
        <span style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          backgroundColor: 'rgba(20, 24, 30, 0.75)',
          borderRadius: 'inherit',
          zIndex: 10
        }}>
          <LoadingNet compact message="" />
        </span>
      )}
      <span style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        opacity: showLoading ? 0.5 : 1,
        transition: 'opacity 0.2s'
      }}>
        {leftIcon && <span className="btn-icon">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="btn-icon">{rightIcon}</span>}
      </span>
    </button>
  );
};
