import React from 'react';
import { SkeletonBox, SkeletonText } from '../../shared/SkeletonPrimitives';

export const SettingsSkeleton: React.FC = () => {
  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <SkeletonText width="200px" height="28px" style={{ marginBottom: '8px' }} />
        <SkeletonText width="300px" height="16px" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SkeletonText width="160px" height="20px" style={{ marginBottom: '8px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <SkeletonText width="100px" height="14px" style={{ marginBottom: '6px' }} />
                <SkeletonBox width="100%" height="38px" borderRadius="2px" />
              </div>
              <div>
                <SkeletonText width="100px" height="14px" style={{ marginBottom: '6px' }} />
                <SkeletonBox width="100%" height="38px" borderRadius="2px" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
