import React, { type ReactNode } from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  alert?: boolean;
  gaugeId?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  alert = false,
  gaugeId,
  className = '',
  style
}) => {
  const generatedId = gaugeId || `[GAUGE_${label.toUpperCase().replace(/\s+/g, '_')}]`;

  return (
    <div 
      className={`card metric-card ${alert ? 'metric-card--alert' : ''} ${className}`}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderLeft: alert ? '3px solid var(--status-error)' : '3px solid var(--accent-primary)',
        borderRadius: 'var(--radius-sm, 2px)',
        padding: '16px 20px',
        boxShadow: 'var(--shadow-paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        ...style
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {alert && (
            <span 
              className="pulse-led"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '1px',
                backgroundColor: 'var(--status-error)',
                display: 'inline-block',
                boxShadow: '0 0 6px var(--status-error)',
                flexShrink: 0
              }} 
            />
          )}
          <span 
            style={{ 
              fontFamily: 'var(--font-mono)', 
              fontSize: '11px', 
              fontWeight: 600, 
              textTransform: 'uppercase', 
              letterSpacing: '0.08em', 
              color: alert ? 'var(--status-error)' : 'var(--text-secondary)' 
            }}
          >
            {label}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span 
            style={{ 
              fontFamily: 'var(--font-mono)', 
              fontSize: '10px', 
              color: 'var(--text-secondary)', 
              opacity: 0.6 
            }}
          >
            {generatedId}
          </span>
          {icon && (
            <span style={{ color: alert ? 'var(--status-error)' : 'var(--text-secondary)', display: 'flex' }}>
              {icon}
            </span>
          )}
        </div>
      </div>

      {/* Data Metric Value */}
      <div 
        className="data-mono metric-value"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '1.75rem',
          fontWeight: 700,
          color: alert ? 'var(--status-error)' : 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginTop: '4px'
        }}
      >
        {value}
      </div>
    </div>
  );
};
