import React from 'react';

export interface HealthMeterProps {
  label: string;
  value: number;
  meterId?: string;
}

export const HealthMeter: React.FC<HealthMeterProps> = ({ label, value, meterId }) => {
  const isWarning = value > 80;
  const tag = meterId || `[${label.toUpperCase().replace(/\s+/g, '_')}]`;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
          {label} <span style={{ opacity: 0.5, fontSize: '10px' }}>{tag}</span>
        </span>
        <span className="data-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: isWarning ? 'var(--status-error)' : 'var(--text-primary)' }}>
          {value}%
        </span>
      </div>
      <div style={{ height: '6px', background: 'var(--bg-surface-alt)', borderRadius: '2px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${Math.min(100, Math.max(0, value))}%`, 
            background: isWarning ? 'var(--status-error)' : 'var(--accent-primary)',
            transition: 'width 0.4s ease' 
          }} 
        />
      </div>
    </div>
  );
};
