// src/pages/user/JobTracker.tsx
import { useEffect, useState } from 'react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { useSessionJobs } from '../../hooks/useSessionJobs';
import { Printer, CheckCircle, Clock, AlertTriangle, PlusCircle } from 'lucide-react';


export function JobTracker() {
  const { reset } = useUserPrintStore();
  const jobs = useSessionJobs(5000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const getStatusDisplay = (status: string, jobsAhead: number) => {
    switch (status) {
      case 'queued': return { icon: <Clock size={24} color="var(--status-busy)" />, text: 'Queued', sub: `${jobsAhead} ahead` };
      case 'spooling': return { icon: <Printer size={24} color="var(--accent-primary)" style={{ animation: 'pulseGlow 2s infinite' }} />, text: 'Spooling', sub: 'Preparing...' };
      case 'printing': return { icon: <Printer size={24} color="var(--status-idle)" style={{ animation: 'pressDown 0.5s infinite' }} />, text: 'Printing', sub: 'Active' };
      case 'done': return { icon: <CheckCircle size={24} color="var(--status-idle)" />, text: 'Done', sub: 'Complete' };
      case 'failed': return { icon: <AlertTriangle size={24} color="var(--status-error)" />, text: 'Error', sub: 'Failed' };
      default: return { icon: <Clock size={24} />, text: 'Unknown', sub: '' };
    }
  };

  // Calculate jobs ahead for queued items
  const activeAndQueued = jobs.filter(j => j.status === 'printing' || j.status === 'spooling' || j.status === 'queued');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Session Job History</h2>
        <button className="btn-mechanical" onClick={reset} style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <PlusCircle size={18} />
          Print Another
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading history...</div>
      ) : jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
          No jobs found in this session.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {jobs.map((job) => {
            let jobsAhead = 0;
            if (job.status === 'queued') {
              const queueIndex = activeAndQueued.findIndex(j => j.id === job.id);
              jobsAhead = Math.max(0, queueIndex);
            }
            const display = getStatusDisplay(job.status, jobsAhead);

            return (
              <div key={job.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', border: job.status === 'failed' ? '2px solid var(--status-error)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px', flexShrink: 0 }}>
                    {display.icon}
                    <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 600 }}>{display.text}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{display.sub}</div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.filename}
                    </h3>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div><strong style={{ color: 'var(--text-primary)' }}>Cost:</strong> ${job.cost.toFixed(2)}</div>
                      <div><strong style={{ color: 'var(--text-primary)' }}>Color:</strong> <span style={{ textTransform: 'capitalize' }}>{job.colorMode}</span></div>
                      <div><strong style={{ color: 'var(--text-primary)' }}>Duplex:</strong> <span style={{ textTransform: 'capitalize' }}>{job.duplex}</span></div>
                      <div><strong style={{ color: 'var(--text-primary)' }}>Copies:</strong> {job.copies}</div>
                    </div>
                  </div>
                </div>

                {job.status === 'failed' && (
                  <div style={{ backgroundColor: 'rgba(234, 57, 67, 0.1)', padding: '1rem', borderRadius: '4px', borderLeft: '4px solid var(--status-error)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      Hardware Error. We have paused your job. Please notify the shop staff.
                    </div>
                    <button className="btn-ghost" style={{ color: 'var(--status-error)', border: '1px solid var(--status-error)', alignSelf: 'flex-start' }} onClick={reset}>
                      Cancel Job &amp; Start Over
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
