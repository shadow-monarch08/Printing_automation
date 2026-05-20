import { useEffect } from 'react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { Layers } from 'lucide-react';

export function ActiveJobIndicator() {
  const { jobs, currentStep, goToStep, fetchJobs, sessionId } = useUserPrintStore();
  const activeJobs = jobs.filter(j => ['queued', 'spooling', 'printing'].includes(j.status));

  // Poll for job updates just to ensure indicator is completely synced,
  // even though SSE will also trigger fetchJobs
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs, sessionId]);

  // Only show if there are active jobs and we are NOT already on the Job Tracker step
  if (activeJobs.length === 0 || currentStep === 4) return null;

  return (
    <div className="modal-wrapper modal--entering" style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none' }}>
      <div className="modal-backdrop modal-backdrop--hidden modal-backdrop--bottom">
        <div className="modal-container sm" style={{ pointerEvents: 'auto', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: 'var(--text-primary)' }}>
              <Layers size={28} color="var(--status-idle)" style={{ animation: 'pulseGlow 2s infinite' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {activeJobs.length} Active {activeJobs.length === 1 ? 'Job' : 'Jobs'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Processing in background</div>
              </div>
            </div>
            <button className="btn" onClick={() => goToStep(4)} style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
              View Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
