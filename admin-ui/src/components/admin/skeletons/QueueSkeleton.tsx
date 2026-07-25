import React from 'react';
import { SkeletonBox, SkeletonText, SkeletonPaperTable } from '../../shared/SkeletonPrimitives';

export const QueueSkeleton: React.FC = () => {
  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <SkeletonText width="180px" height="28px" style={{ marginBottom: '8px' }} />
          <SkeletonText width="260px" height="16px" />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <SkeletonBox width="120px" height="38px" borderRadius="2px" />
          <SkeletonBox width="180px" height="38px" borderRadius="2px" />
        </div>
      </div>

      <SkeletonPaperTable rows={6} cols={6} />
    </div>
  );
};
