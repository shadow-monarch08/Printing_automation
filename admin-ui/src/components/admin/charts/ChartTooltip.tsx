import React from 'react';

export interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  labelFormatter?: (label: any) => string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  labelFormatter
}) => {
  if (!active || !payload || !payload.length) return null;

  const formattedLabel = labelFormatter ? labelFormatter(label) : label;

  return (
    <div 
      className="chart-tooltip-slip"
      style={{
        backgroundColor: 'var(--bg-paper)',
        color: 'var(--text-primary)',
        border: '2px solid var(--border-default)',
        boxShadow: 'var(--shadow-paper)',
        borderRadius: '2px',
        padding: '10px 14px',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        minWidth: '140px',
      }}
    >
      {formattedLabel && (
        <div style={{ fontWeight: 700, borderBottom: '1px dashed var(--border-default)', paddingBottom: '4px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
          ▪ {formattedLabel}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: entry.color || 'var(--text-secondary)' }}>{entry.name || entry.dataKey}:</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
