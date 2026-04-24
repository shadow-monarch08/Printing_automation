// src/pages/user/JobTracker.tsx
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { Printer, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export function JobTracker() {
  const { jobStatus, jobId, jobsAhead, reset, filePreview } = useUserPrintStore();

  const getStatusDisplay = () => {
    switch (jobStatus) {
      case 'queued': return { icon: <Clock size={48} color="var(--status-busy)" />, text: 'Queued', sub: `${jobsAhead} jobs ahead of you` };
      case 'spooling': return { icon: <Printer size={48} color="var(--accent-primary)" style={{ animation: 'pulseGlow 2s infinite' }} />, text: 'Spooling to Hardware', sub: 'Preparing raster data...' };
      case 'printing': return { icon: <Printer size={48} color="var(--status-idle)" style={{ animation: 'pressDown 0.5s infinite' }} />, text: 'Printing in Progress', sub: 'Mechanical extrusion active' };
      case 'done': return { icon: <CheckCircle size={48} color="var(--status-idle)" />, text: 'Job Complete', sub: 'Please collect output below' };
      case 'failed': return { icon: <AlertTriangle size={48} color="var(--status-error)" />, text: 'Hardware Error', sub: 'Please contact administrator' };
      default: return { icon: <Clock size={48} />, text: 'Unknown', sub: '' };
    }
  };

  const display = getStatusDisplay();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      
      <div className="card tracker-card">
        
        <div style={{ margin: '0 auto 2rem', display: 'flex', justifyContent: 'center' }}>
          {display.icon}
        </div>

        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{display.text}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem' }}>{display.sub}</p>

        <div className="tracker-meta">
          <div className="tracker-meta-row" style={{ marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Job ID</span>
            <span className="data-mono">{jobId}</span>
          </div>
          <div className="tracker-meta-row">
            <span style={{ color: 'var(--text-secondary)' }}>Document</span>
            <span className="data-mono">
              {filePreview?.name}
            </span>
          </div>
        </div>

        {(jobStatus === 'done' || jobStatus === 'failed') && (
          <div style={{ marginTop: '2.5rem' }}>
            <button className="btn-mechanical" onClick={reset}>
               Start New Job
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
