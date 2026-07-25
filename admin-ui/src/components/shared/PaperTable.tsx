import React from 'react';

export interface PaperTableProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const PaperTable: React.FC<PaperTableProps> = ({ children, className = '', style }) => {
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
        ...style
      }}
    >
      {/* Tractor Feed Left & Right Perforation Hole Accents */}
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
          pointerEvents: 'none',
          zIndex: 5
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
          pointerEvents: 'none',
          zIndex: 5
        }} 
      />
      
      {/* Scrollable Table Area */}
      <div style={{ overflowX: 'auto', padding: '16px' }}>
        {children}
      </div>

      {/* Bottom Paper Curl Drop-Shadow Accent */}
      <div 
        style={{
          height: '4px',
          background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.08))',
          pointerEvents: 'none'
        }} 
      />
    </div>
  );
};
