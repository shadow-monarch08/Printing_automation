import React from 'react';
import { SkeletonBox, SkeletonText } from '../../shared/SkeletonPrimitives';

export const FleetSkeleton: React.FC = () => {
  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <SkeletonText width="160px" height="28px" style={{ marginBottom: '8px' }} />
          <SkeletonText width="240px" height="16px" />
        </div>
        <SkeletonBox width="140px" height="38px" borderRadius="2px" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <SkeletonBox width="36px" height="36px" borderRadius="2px" />
                <div>
                  <SkeletonText width="120px" height="18px" style={{ marginBottom: '4px' }} />
                  <SkeletonText width="80px" height="12px" />
                </div>
              </div>
              <SkeletonBox width="60px" height="20px" borderRadius="2px" />
            </div>

            <SkeletonBox width="100%" height="36px" borderRadius="2px" />

            <div style={{ display: 'flex', gap: '8px' }}>
              <SkeletonBox width="60px" height="22px" borderRadius="2px" />
              <SkeletonBox width="60px" height="22px" borderRadius="2px" />
              <SkeletonBox width="60px" height="22px" borderRadius="2px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
