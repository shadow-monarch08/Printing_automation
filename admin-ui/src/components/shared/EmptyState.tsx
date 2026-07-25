import React, { type ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionButton?: ReactNode;
  children?: ReactNode;
}

const DefaultPixelPrinterHatch = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Printer Body Frame */}
    <rect x="8" y="24" width="48" height="28" rx="2" fill="var(--bg-primary)" stroke="var(--border-default)" strokeWidth="2" />
    {/* Paper Output Slot */}
    <line x1="16" y1="32" x2="48" y2="32" stroke="var(--accent-primary)" strokeWidth="2" strokeDasharray="4 2" />
    {/* Open Tray Hatch Flap */}
    <path d="M12 40H52L48 56H16L12 40Z" fill="var(--bg-surface-hover)" stroke="var(--border-default)" strokeWidth="2" />
    {/* Status LED Off */}
    <rect x="44" y="28" width="4" height="4" fill="var(--text-secondary)" opacity="0.5" />
    {/* Empty Indicator Line */}
    <line x1="20" y1="48" x2="44" y2="48" stroke="var(--status-busy)" strokeWidth="2" strokeDasharray="2 2" />
  </svg>
);

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionButton,
  children
}) => {
  return (
    <div 
      className="empty-state empty-tray-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        margin: '24px auto',
        maxWidth: '560px',
        width: '100%',
        backgroundColor: 'var(--bg-surface)',
        border: '2px dashed var(--border-default)',
        borderRadius: '4px',
        textAlign: 'center'
      }}
    >
      <div 
        className="empty-state-icon"
        style={{
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {icon || <DefaultPixelPrinterHatch />}
      </div>

      <h3 
        className="empty-state-title"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '16px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-primary)',
          margin: 0
        }}
      >
        {title}
      </h3>

      <p 
        className="empty-state-desc"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          maxWidth: '360px',
          marginTop: '8px',
          marginBottom: (actionButton || children) ? '20px' : 0,
          lineHeight: 1.5
        }}
      >
        {description}
      </p>

      {(actionButton || children) && (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {actionButton}
          {children}
        </div>
      )}
    </div>
  );
};
