import React from 'react';
import { SkeletonBox, SkeletonText } from '../../shared/SkeletonPrimitives';

export const KioskConfigSkeleton: React.FC = () => {
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SkeletonBox width="28px" height="28px" borderRadius="50%" />
            <SkeletonText width="80px" height="14px" />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Preview Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <SkeletonText width="140px" height="18px" />
          <SkeletonBox width="100%" height="320px" borderRadius="2px" />
        </div>

        {/* Right Column: Config Console */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SkeletonText width="160px" height="20px" />
          
          <div>
            <SkeletonText width="100px" height="14px" style={{ marginBottom: '8px' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <SkeletonBox width="100px" height="38px" borderRadius="2px" />
              <SkeletonBox width="100px" height="38px" borderRadius="2px" />
            </div>
          </div>

          <div>
            <SkeletonText width="120px" height="14px" style={{ marginBottom: '8px' }} />
            <SkeletonBox width="100%" height="42px" borderRadius="2px" />
          </div>

          <SkeletonBox width="100%" height="48px" borderRadius="2px" style={{ marginTop: 'auto' }} />
        </div>
      </div>
    </div>
  );
};
