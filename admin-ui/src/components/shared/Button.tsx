import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'mechanical' | 'danger' | 'ghost' | 'primary';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'mechanical',
  isLoading = false,
  disabled,
  className = '',
  leftIcon,
  rightIcon,
  ...props
}) => {
  const btnClass = `btn-${variant} ${className}`.trim();
  
  return (
    <button 
      className={btnClass} 
      disabled={isLoading || disabled} 
      {...props}
    >
      {isLoading && <Loader2 className="btn-spinner" size={16} />}
      {!isLoading && leftIcon && <span className="btn-icon">{leftIcon}</span>}
      <span style={{ opacity: isLoading ? 0.8 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>{children}</span>
      {!isLoading && rightIcon && <span className="btn-icon">{rightIcon}</span>}
    </button>
  );
};
