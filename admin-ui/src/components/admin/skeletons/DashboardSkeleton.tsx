import React from 'react';
import { SkeletonBox, SkeletonText } from '../../shared/SkeletonPrimitives';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      {/* Header Skeleton */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <SkeletonText width="180px" height="28px" style={{ marginBottom: '8px' }} />
          <SkeletonText width="260px" height="16px" />
        </div>
        <SkeletonBox width="180px" height="38px" borderRadius="2px" />
      </div>

      {/* 4 Metric Cards Wireframe */}
      <div className="dashboard-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ padding: '16px 20px', borderLeft: '3px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <SkeletonText width="100px" height="14px" />
              <SkeletonBox width="18px" height="18px" borderRadius="2px" />
            </div>
            <SkeletonBox width="120px" height="32px" borderRadius="2px" />
          </div>
        ))}
      </div>

      {/* Middle Grid Wireframe */}
      <div className="dashboard-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* System Health Panel Wireframe */}
        <div className="card" style={{ padding: '24px' }}>
          <SkeletonText width="140px" height="20px" style={{ marginBottom: '24px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <SkeletonText width="80px" height="14px" />
                  <SkeletonText width="40px" height="14px" />
                </div>
                <SkeletonBox width="100%" height="6px" borderRadius="2px" />
              </div>
            ))}
          </div>
        </div>

        {/* Resource Usage Graph Wireframe */}
        <div className="card" style={{ padding: '24px', minHeight: '300px' }}>
          <SkeletonText width="200px" height="20px" style={{ marginBottom: '24px' }} />
          <SkeletonBox width="100%" height="200px" borderRadius="2px" />
        </div>
      {/* Resource Usage & Health Panels */}
      </div>
    </div>
  );
};
