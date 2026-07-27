import { useEffect, useState } from 'react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { useSessionJobs } from '../../hooks/useSessionJobs';
import { PlusCircle, Printer, AlertTriangle, Cpu, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { soundFx } from '../../utils/sound';

export function JobTracker() {
  const { jobId, jobStatus, filePreview, copies, reset } = useUserPrintStore();
  const sessionJobs = useSessionJobs(3000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 200);
    return () => clearTimeout(timer);
  }, []);

  // Determine list of jobs to display
  const displayJobs: any[] = sessionJobs && sessionJobs.length > 0
    ? sessionJobs
    : jobId
    ? [{
        id: jobId,
        filename: filePreview?.name || 'Document.pdf',
        pages: filePreview?.pages || 1,
        copies: copies || 1,
        colorMode: 'grayscale',
        duplex: 'single',
        status: jobStatus || 'spooling',
        cost: 0,
        submittedAt: new Date().toISOString()
      }]
    : [];

  const getStatusBadge = (status: string, position: number) => {
    switch (status) {
      case 'queued':
        return {
          icon: <Clock size={16} color="var(--accent-primary)" />,
          label: 'QUEUED',
          sub: position > 0 ? `#${position} in queue` : 'Waiting...',
          color: 'var(--accent-primary)',
          borderColor: 'var(--border-default)'
        };
      case 'spooling':
      case 'rasterizing':
        return {
          icon: <Cpu size={16} color="var(--accent-primary)" style={{ animation: 'pulseLed 1.2s infinite' }} />,
          label: 'SPOOLING',
          sub: 'Processing...',
          color: 'var(--accent-primary)',
          borderColor: 'var(--accent-primary)'
        };
      case 'printing':
        return {
          icon: <Printer size={16} color="var(--status-idle, #10B981)" style={{ animation: 'pulseLed 1.2s infinite' }} />,
          label: 'PRINTING',
          sub: 'Active Tray',
          color: 'var(--status-idle, #10B981)',
          borderColor: 'var(--status-idle, #10B981)'
        };
      case 'done':
      case 'completed':
        return {
          icon: <CheckCircle2 size={16} color="var(--status-idle, #10B981)" />,
          label: 'DONE',
          sub: 'Dispatched',
          color: 'var(--status-idle, #10B981)',
          borderColor: 'var(--border-default)'
        };
      case 'failed':
        return {
          icon: <AlertTriangle size={16} color="var(--status-error)" />,
          label: 'FAILED',
          sub: 'Error',
          color: 'var(--status-error)',
          borderColor: 'var(--status-error)'
        };
      default:
        return {
          icon: <Clock size={16} color="var(--text-secondary)" />,
          label: status.toUpperCase(),
          sub: '',
          color: 'var(--text-secondary)',
          borderColor: 'var(--border-default)'
        };
    }
  };

  if (!loading && displayJobs.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', flex: 1, width: '100%' }}>
        <EmptyState
          iconType="empty-paper"
          title="[NO_ACTIVE_SUBMISSION]"
          description="There are currently no active print jobs linked to your kiosk session."
        >
          <Button variant="primary" onClick={reset} leftIcon={<PlusCircle size={16} />} style={{ minHeight: '48px' }}>
            CREATE NEW PRINT JOB
          </Button>
        </EmptyState>
      </div>
    );
  }

  const activeCount = displayJobs.filter(j => ['queued', 'spooling', 'printing'].includes(j.status)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            [SESSION_PRINT_QUEUE]
          </h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {activeCount > 0 ? `${activeCount} ACTIVE JOB${activeCount === 1 ? '' : 'S'} IN PROCESSING` : 'ALL JOBS COMPLETED'}
          </span>
        </div>

        <Button 
          variant="mechanical" 
          onClick={() => { soundFx.playClick(); reset(); }} 
          leftIcon={<PlusCircle size={16} />}
          style={{ padding: '8px 14px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}
        >
          PRINT ANOTHER DOCUMENT
        </Button>
      </div>

      {/* Lean Jobs Card List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {displayJobs.map((job, index) => {
          const badge = getStatusBadge(job.status, index + 1);
          const isFailed = job.status === 'failed';

          return (
            <div
              key={job.id || index}
              className="card"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: isFailed ? '2px solid var(--status-error)' : '1.5px solid var(--border-default)',
                borderRadius: 'var(--radius-sm, 4px)',
                boxShadow: 'var(--shadow-paper)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Card Top Row: Badge + Filename + Cost */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
                {/* Compact Status Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    borderRadius: '2px',
                    border: `1px solid ${badge.borderColor}`,
                    backgroundColor: 'var(--bg-primary)',
                    flexShrink: 0
                  }}
                >
                  {badge.icon}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 800, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>

                {/* Filename & UUID */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      margin: 0,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={job.filename}
                  >
                    {job.filename}
                  </h4>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    ID: {(job.id || '').substring(0, 12)}...
                  </span>
                </div>

                {/* Cost */}
                {job.cost > 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)', flexShrink: 0 }}>
                    ₹{job.cost.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Card Bottom Row: Monospace Tech Specs Badges */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed var(--border-default)', paddingTop: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="badge badge-default" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                    {job.pages || 1} {job.pages === 1 ? 'PAGE' : 'PAGES'}
                  </span>
                  <span className="badge badge-default" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                    {job.copies || 1} {job.copies === 1 ? 'COPY' : 'COPIES'}
                  </span>
                  {job.colorMode && (
                    <span className="badge badge-default" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                      {job.colorMode}
                    </span>
                  )}
                  {job.duplex && (
                    <span className="badge badge-default" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                      {job.duplex}
                    </span>
                  )}
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {badge.sub}
                </div>
              </div>

              {/* Failure Warning Box if job failed */}
              {isFailed && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid var(--status-error)',
                    padding: '8px 12px',
                    borderRadius: '2px',
                    color: 'var(--status-error)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginTop: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} />
                    <span>{job.error || 'Hardware jam or CUPS spooling timeout.'}</span>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => { soundFx.playClick(); reset(); }}
                    style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.7rem' }}
                  >
                    RETRY
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
