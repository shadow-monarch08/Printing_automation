import React from 'react';

export interface SkeletonBoxProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width = '100%',
  height = '100%',
  borderRadius = '2px',
  className = '',
  style
}) => {
  return (
    <div 
      className={`skeleton-box relative overflow-hidden ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--bg-surface-alt)',
        position: 'relative',
        ...style
      }}
    >
      <div 
        className="skeleton-shimmer"
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'translateX(-100%)',
          background: 'linear-gradient(90deg, transparent 0%, var(--accent-glow) 50%, transparent 100%)',
          animation: 'shimmer 1.5s infinite'
        }}
      />
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export const SkeletonText: React.FC<{ width?: string | number; height?: string | number; className?: string; style?: React.CSSProperties }> = ({
  width = '60%',
  height = '14px',
  className = '',
  style
}) => {
  return <SkeletonBox width={width} height={height} borderRadius="2px" className={className} style={style} />;
};

export const SkeletonPaperTable: React.FC<{ rows?: number; cols?: number; className?: string }> = ({
  rows = 5,
  cols = 5,
  className = ''
}) => {
  return (
    <div 
      className={`paper-sheet-container paper-sheet-table table-wrapper ${className}`}
      style={{
        position: 'relative',
        backgroundColor: 'var(--bg-paper)',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-paper)',
        borderTop: '2px dashed var(--border-default)',
        borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
        margin: '24px 0',
        overflow: 'hidden',
        padding: '16px'
      }}
    >
      {/* Tractor Feed Left & Right Perforation Accents */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '12px',
          height: '12px',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          pointerEvents: 'none'
        }} 
      />
      <div 
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '12px',
          height: '12px',
          transform: 'translate(50%, -50%)',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          pointerEvents: 'none'
        }} 
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Table Header Wireframe */}
        <div style={{ display: 'flex', gap: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--border-default)' }}>
          {Array.from({ length: cols }).map((_, i) => (
            <SkeletonText key={`h-${i}`} width={`${100 / cols}%`} height="16px" />
          ))}
        </div>

        {/* Table Rows Wireframe */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`r-${r}`} style={{ display: 'flex', gap: '16px', padding: '8px 0', borderBottom: '1px solid var(--border-default)' }}>
            {Array.from({ length: cols }).map((_, c) => (
              <SkeletonBox key={`c-${r}-${c}`} width={`${100 / cols}%`} height="18px" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
