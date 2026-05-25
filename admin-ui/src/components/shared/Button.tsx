import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

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
      {showLoading && <Loader2 className="btn-spinner" size={16} />}
      {!showLoading && leftIcon && <span className="btn-icon">{leftIcon}</span>}
      <span style={{ opacity: showLoading ? 0.8 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>{children}</span>
      {!showLoading && rightIcon && <span className="btn-icon">{rightIcon}</span>}
    </button>
  );
};
