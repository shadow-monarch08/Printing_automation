import React from 'react';
import { SkeletonBox, SkeletonText } from '../../shared/SkeletonPrimitives';

export const KioskQuoteSkeleton: React.FC = () => {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SkeletonBox width="28px" height="28px" borderRadius="50%" />
            <SkeletonText width="80px" height="14px" />
          </div>
        ))}
      </div>

      {/* Main Quote Receipt Sheet Wireframe */}
      <div 
        className="paper-sheet-container"
        style={{
          backgroundColor: 'var(--bg-paper)',
          borderTop: '2px dashed var(--border-default)',
          boxShadow: 'var(--shadow-paper)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <SkeletonText width="160px" height="22px" />
          <SkeletonText width="100px" height="12px" />
        </div>

        <div style={{ borderTop: '1px dashed var(--border-default)', borderBottom: '1px dashed var(--border-default)', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <SkeletonText width="120px" height="14px" />
              <SkeletonText width="60px" height="14px" />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonText width="100px" height="18px" />
          <SkeletonText width="80px" height="24px" />
        </div>

        <SkeletonBox width="100%" height="48px" borderRadius="2px" style={{ marginTop: '16px' }} />
      </div>
    </div>
  );
};
