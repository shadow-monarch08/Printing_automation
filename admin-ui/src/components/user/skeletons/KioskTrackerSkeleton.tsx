import React from 'react';
import { SkeletonBox, SkeletonText } from '../../shared/SkeletonPrimitives';

export const KioskTrackerSkeleton: React.FC = () => {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
      <div className="card" style={{ padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SkeletonBox width="10px" height="10px" borderRadius="1px" />
          <SkeletonText width="140px" height="16px" />
        </div>

        <SkeletonBox width="80px" height="80px" borderRadius="50%" />

        <SkeletonText width="220px" height="24px" />
        <SkeletonText width="180px" height="14px" />

        <SkeletonBox width="100%" height="8px" borderRadius="4px" style={{ margin: '12px 0' }} />

        <SkeletonBox width="160px" height="42px" borderRadius="2px" />
      </div>
    </div>
  );
};
