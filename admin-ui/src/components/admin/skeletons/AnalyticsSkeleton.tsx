import React from 'react';
import { SkeletonBox, SkeletonText, SkeletonPaperTable } from '../../shared/SkeletonPrimitives';

export const AnalyticsSkeleton: React.FC = () => {
  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <SkeletonText width="220px" height="28px" style={{ marginBottom: '8px' }} />
          <SkeletonText width="280px" height="16px" />
        </div>
        <SkeletonBox width="280px" height="38px" borderRadius="2px" />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <SkeletonBox width="140px" height="36px" borderRadius="2px" />
        <SkeletonBox width="140px" height="36px" borderRadius="2px" />
        <SkeletonBox width="140px" height="36px" borderRadius="2px" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ padding: '16px 20px', borderLeft: '3px solid var(--border-default)' }}>
            <SkeletonText width="100px" height="14px" style={{ marginBottom: '12px' }} />
            <SkeletonBox width="120px" height="32px" borderRadius="2px" />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <SkeletonText width="160px" height="20px" style={{ marginBottom: '24px' }} />
          <SkeletonBox width="100%" height="260px" borderRadius="2px" />
        </div>
        <div className="card" style={{ padding: '24px' }}>
          <SkeletonText width="180px" height="20px" style={{ marginBottom: '24px' }} />
          <SkeletonBox width="100%" height="260px" borderRadius="2px" />
        </div>
      </div>

      <SkeletonPaperTable rows={5} cols={8} />
    </div>
  );
};
