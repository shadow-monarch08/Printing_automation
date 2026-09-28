import React from 'react';
import { SkeletonBox, SkeletonText } from '../../shared/SkeletonPrimitives';

export const KioskUploadSkeleton: React.FC = () => {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      {/* 4-Step Stepper Wireframe */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SkeletonBox width="28px" height="28px" borderRadius="50%" />
            <SkeletonText width="80px" height="14px" />
          </div>
        ))}
      </div>

      {/* Main Drag-and-Drop Dropzone Wireframe */}
      <div 
        className="card" 
        style={{
          padding: '60px 24px',
          border: '2px dashed var(--border-default)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <SkeletonBox width="64px" height="64px" borderRadius="4px" />
        <SkeletonText width="240px" height="20px" />
        <SkeletonText width="320px" height="14px" />
        <SkeletonBox width="160px" height="42px" borderRadius="2px" style={{ marginTop: '16px' }} />
      </div>
    </div>
  );
};
