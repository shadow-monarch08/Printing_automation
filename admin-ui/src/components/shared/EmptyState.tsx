import React, { type ReactNode } from 'react';

export type EmptyStateIconType = 'printer-hatch' | 'unlinked-cable' | 'empty-paper' | 'gear-jam';

export interface EmptyStateProps {
  iconType?: EmptyStateIconType;
  icon?: ReactNode;
  title: string;
  description: string;
  actionButton?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const PixelIconRenderer: React.FC<{ type: EmptyStateIconType }> = ({ type }) => {
  switch (type) {
    case 'unlinked-cable':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ shapeRendering: 'crispEdges' }}>
          {/* Left Severed Plug */}
          <rect x="8" y="28" width="16" height="8" fill="var(--text-secondary)" />
          <rect x="4" y="30" width="4" height="4" fill="var(--text-muted)" />
          <rect x="24" y="30" width="4" height="4" fill="var(--accent-primary)" />
          {/* Right Severed Plug */}
          <rect x="40" y="28" width="16" height="8" fill="var(--text-secondary)" />
          <rect x="56" y="30" width="4" height="4" fill="var(--text-muted)" />
          <rect x="36" y="30" width="4" height="4" fill="var(--accent-primary)" />
          {/* Floating Spark Pixels */}
          <rect x="30" y="22" width="3" height="3" fill="var(--accent-primary)" />
          <rect x="32" y="38" width="3" height="3" fill="var(--status-error, #FF4444)" />
          <rect x="28" y="34" width="2" height="2" fill="var(--accent-primary)" />
          <rect x="34" y="26" width="2" height="2" fill="var(--status-error, #FF4444)" />
        </svg>
      );
    case 'empty-paper':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ shapeRendering: 'crispEdges' }}>
          {/* Tractor Feed Paper Sheet */}
          <rect x="14" y="10" width="36" height="44" fill="var(--bg-paper)" stroke="var(--border-default)" strokeWidth="2" />
          {/* Side Perforation Holes */}
          <rect x="16" y="14" width="2" height="2" fill="var(--text-secondary)" />
          <rect x="16" y="22" width="2" height="2" fill="var(--text-secondary)" />
          <rect x="16" y="30" width="2" height="2" fill="var(--text-secondary)" />
          <rect x="16" y="38" width="2" height="2" fill="var(--text-secondary)" />
          <rect x="16" y="46" width="2" height="2" fill="var(--text-secondary)" />

          <rect x="46" y="14" width="2" height="2" fill="var(--text-secondary)" />
          <rect x="46" y="22" width="2" height="2" fill="var(--text-secondary)" />
          <rect x="46" y="30" width="2" height="2" fill="var(--text-secondary)" />
          <rect x="46" y="38" width="2" height="2" fill="var(--text-secondary)" />
          <rect x="46" y="46" width="2" height="2" fill="var(--text-secondary)" />

          {/* Empty Tray Dashed Lines */}
          <line x1="22" y1="20" x2="42" y2="20" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="3 3" />
          <line x1="22" y1="28" x2="38" y2="28" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="3 3" />
          <line x1="22" y1="36" x2="40" y2="36" stroke="var(--accent-primary)" strokeWidth="2" strokeDasharray="2 2" />
        </svg>
      );
    case 'gear-jam':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ shapeRendering: 'crispEdges' }}>
          {/* Gear 1 */}
          <rect x="12" y="12" width="24" height="24" fill="var(--text-secondary)" opacity="0.8" />
          <rect x="18" y="18" width="12" height="12" fill="var(--bg-surface)" />
          <rect x="8" y="20" width="4" height="8" fill="var(--text-secondary)" />
          <rect x="36" y="20" width="4" height="8" fill="var(--text-secondary)" />
          <rect x="20" y="8" width="8" height="4" fill="var(--text-secondary)" />
          <rect x="20" y="36" width="8" height="4" fill="var(--text-secondary)" />

          {/* Gear 2 */}
          <rect x="28" y="28" width="24" height="24" fill="var(--text-secondary)" opacity="0.8" />
          <rect x="34" y="34" width="12" height="12" fill="var(--bg-surface)" />

          {/* Stamped Error 'X' Badge */}
          <rect x="24" y="24" width="16" height="16" fill="var(--status-error, #FF4444)" />
          <path d="M28 28L36 36M36 28L28 36" stroke="#FFFFFF" strokeWidth="2" />
        </svg>
      );
    case 'printer-hatch':
    default:
      return (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ shapeRendering: 'crispEdges' }}>
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
          {/* Down Arrow pointing into tray */}
          <path d="M32 8V20M28 16L32 20L36 16" stroke="var(--accent-primary)" strokeWidth="2" />
        </svg>
      );
  }
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  iconType = 'printer-hatch',
  icon,
  title,
  description,
  actionButton,
  children,
  className = '',
  style
}) => {
  const formattedTitle = title.startsWith('[') ? title : `[SYS_NOTICE] ${title.toUpperCase()}`;

  return (
    <div 
      className={`empty-state-card empty-tray-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        margin: '24px auto',
        maxWidth: '560px',
        width: '100%',
        backgroundColor: 'var(--bg-surface)',
        border: '2px dashed var(--border-default)',
        borderRadius: 'var(--radius-md, 4px)',
        boxShadow: 'inset 0 0 12px rgba(0, 0, 0, 0.2)',
        textAlign: 'center',
        boxSizing: 'border-box',
        ...style
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
        {icon || <PixelIconRenderer type={iconType} />}
      </div>

      <h3 
        className="empty-state-title"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '15px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-primary)',
          margin: 0
        }}
      >
        {formattedTitle}
      </h3>

      <p 
        className="empty-state-desc"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          maxWidth: '380px',
          marginTop: '10px',
          marginBottom: 0,
          lineHeight: 1.5
        }}
      >
        {description}
      </p>

      {(actionButton || children) && (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
          {actionButton}
          {children}
        </div>
      )}
    </div>
  );
};
