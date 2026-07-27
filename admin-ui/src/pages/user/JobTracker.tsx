import { useEffect, useState } from 'react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { useSessionJobs } from '../../hooks/useSessionJobs';
import { PlusCircle, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { soundFx } from '../../utils/sound';
import type { BackendJob } from '../../types';

export function JobTracker() {
  const { jobId, jobStatus, jobsAhead, filePreview, copies, reset } = useUserPrintStore();
  const sessionJobs = useSessionJobs(3000);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionJobs && sessionJobs.length > 0) {
      if (!selectedJobId || !sessionJobs.some((j: BackendJob) => j.id === selectedJobId)) {
        const active = sessionJobs.find((j: BackendJob) => ['printing', 'spooling', 'queued'].includes(j.status)) || sessionJobs[0];
        setSelectedJobId(active.id);
      }
    } else if (jobId) {
      setSelectedJobId(jobId);
    }
  }, [sessionJobs, jobId]);

  if ((!sessionJobs || sessionJobs.length === 0) && !jobId) {
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

  const selectedJob = sessionJobs?.find((j: BackendJob) => j.id === selectedJobId) || (sessionJobs && sessionJobs.length > 0 ? sessionJobs[0] : null);

  const currentJobId = selectedJob?.id || jobId || 'LOCAL-PAYLOAD';
  const currentStatus = selectedJob?.status || jobStatus || 'spooling';
  const fileName = selectedJob?.filename || filePreview?.name || 'document.pdf';
  const totalPages = selectedJob?.pages || filePreview?.pages || 1;
  const totalCopies = selectedJob?.copies || copies || 1;
  const pos = jobsAhead ?? 1;

  const steps = [
    { key: 'spooling', label: 'Spooling' },
    { key: 'rasterizing', label: 'Rasterizing' },
    { key: 'printing', label: 'Printing' },
    { key: 'completed', label: 'Dispatched' }
  ];

  const getStepState = (stepKey: string): 'done' | 'active' | 'pending' | 'failed' => {
    if (currentStatus === 'done') return 'done';
    if (currentStatus === 'failed') return 'failed';
    if (currentStatus === 'printing') {
      if (stepKey === 'spooling' || stepKey === 'rasterizing') return 'done';
      if (stepKey === 'printing') return 'active';
      return 'pending';
    }
    if (currentStatus === 'spooling' || currentStatus === 'queued') {
      if (stepKey === 'spooling') return 'active';
      return 'pending';
    }
    return 'pending';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, width: '100%', maxWidth: '680px', margin: '0 auto' }}>

      {/* Header & New Submission Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 800, margin: 0, letterSpacing: '0.05em' }}>
            [JOB_TRACKER]
          </h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            // {sessionJobs?.length || 1} TOTAL
          </span>
        </div>
        <Button variant="ghost" onClick={reset} leftIcon={<PlusCircle size={14} />} style={{ minHeight: '34px', padding: '4px 10px', fontSize: '0.8rem' }}>
          + Add Job
        </Button>
      </div>

      {/* Compact Multi-Job Selector Tabs */}
      {sessionJobs && sessionJobs.length > 1 && (
        <div 
          className="job-switcher-tabs" 
          style={{ 
            display: 'flex', 
            gap: '6px', 
            overflowX: 'auto', 
            paddingBottom: '2px', 
            maxWidth: '100%',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {sessionJobs.map((j: BackendJob, index: number) => {
            const isSelected = j.id === currentJobId;
            const jStatus = j.status || 'queued';
            let dotColor = 'var(--accent-primary)';
            if (jStatus === 'failed') dotColor = 'var(--status-error)';
            if (jStatus === 'done') dotColor = 'var(--status-idle, #10B981)';

            return (
              <button
                key={j.id || index}
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setSelectedJobId(j.id);
                }}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  fontWeight: isSelected ? 800 : 500,
                  padding: '6px 12px',
                  borderRadius: '2px',
                  border: isSelected ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  backgroundColor: isSelected ? 'var(--bg-surface)' : 'var(--bg-surface-alt)',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor }} />
                <span>#0{index + 1} {j.filename || 'Doc'}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sleek Compact Job Card */}
      <div 
        className="card tracker-card"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1.5px solid var(--border-default)',
          borderTop: '3px solid var(--accent-primary)',
          borderRadius: 'var(--radius-sm, 4px)',
          boxShadow: 'var(--shadow-paper)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {/* Top Header: File Info & Live Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <FileText size={18} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <h3 
                style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '0.85rem', 
                  fontWeight: 700, 
                  margin: 0, 
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '240px'
                }}
                title={fileName}
              >
                {fileName}
              </h3>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {totalPages} pgs • {totalCopies} {totalCopies === 1 ? 'copy' : 'copies'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div 
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '4px 8px',
                borderRadius: '2px',
                border: currentStatus === 'failed' ? '1px solid var(--status-error)' : currentStatus === 'done' ? '1px solid var(--status-idle, #10B981)' : '1px solid var(--accent-primary)',
                backgroundColor: currentStatus === 'failed' ? 'rgba(239, 68, 68, 0.1)' : currentStatus === 'done' ? 'rgba(16, 185, 129, 0.1)' : 'var(--accent-glow)',
                color: currentStatus === 'failed' ? 'var(--status-error)' : currentStatus === 'done' ? 'var(--status-idle, #10B981)' : 'var(--accent-primary)',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <div 
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: currentStatus === 'failed' ? 'var(--status-error)' : currentStatus === 'done' ? 'var(--status-idle, #10B981)' : 'var(--accent-primary)',
                  boxShadow: `0 0 6px ${currentStatus === 'failed' ? 'var(--status-error)' : 'var(--accent-primary)'}`
                }}
              />
              <span>{currentStatus}</span>
            </div>
          </div>
        </div>

        {/* Horizontal Compact Timeline Steps */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-default)',
            padding: '10px 8px',
            borderRadius: '2px'
          }}
        >
          {steps.map((step, idx) => {
            const st = getStepState(step.key);
            let iconColor = 'var(--text-secondary)';
            let labelColor = 'var(--text-secondary)';
            let borderColor = 'transparent';

            if (st === 'done') {
              iconColor = 'var(--status-idle, #10B981)';
              labelColor = 'var(--text-primary)';
            } else if (st === 'active') {
              iconColor = 'var(--accent-primary)';
              labelColor = 'var(--accent-primary)';
              borderColor = 'var(--accent-primary)';
            } else if (st === 'failed') {
              iconColor = 'var(--status-error)';
              labelColor = 'var(--status-error)';
            }

            return (
              <div 
                key={step.key} 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  textAlign: 'center',
                  padding: '4px 2px',
                  borderBottom: `2px solid ${borderColor}`,
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {st === 'done' ? (
                    <CheckCircle2 size={15} color={iconColor} />
                  ) : st === 'active' ? (
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                  ) : st === 'failed' ? (
                    <AlertTriangle size={15} color={iconColor} />
                  ) : (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--border-default)' }} />
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: st === 'active' ? 800 : st === 'done' ? 700 : 400, color: labelColor }}>
                  0{idx + 1}. {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Failure Banner if any */}
        {currentStatus === 'failed' && (
          <div 
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--status-error)',
              padding: '10px 12px',
              borderRadius: '2px',
              color: 'var(--status-error)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={15} />
              <span>Hardware stall / CUPS timeout.</span>
            </div>
            <Button variant="danger" onClick={reset} style={{ minHeight: '30px', padding: '0.2rem 0.6rem', fontSize: '0.7rem' }}>
              Retry
            </Button>
          </div>
        )}

        {/* Monospace Compact Metadata Strip */}
        <div 
          style={{
            backgroundColor: 'var(--bg-surface-alt)',
            border: '1px solid var(--border-default)',
            padding: '8px 12px',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem'
          }}
        >
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>ID:</span>
            <span className="data-mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {currentJobId.substring(0, 12)}...
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>POS:</span>
            <span className="data-mono" style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>
              #{pos}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
