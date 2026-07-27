import { useEffect, useState } from 'react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { useSessionJobs } from '../../hooks/useSessionJobs';
import { PlusCircle, Printer, AlertTriangle, Cpu, Layers, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { soundFx } from '../../utils/sound';
import type { BackendJob } from '../../types';

const PipelineStatusIndicator = ({ state }: { state: 'done' | 'active' | 'pending' | 'failed' }) => {
  if (state === 'done') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ shapeRendering: 'crispEdges', flexShrink: 0 }}>
        <rect x="2" y="2" width="16" height="16" fill="var(--bg-surface-hover)" stroke="var(--status-idle, #10B981)" strokeWidth="2" rx="2" />
        <path d="M6 10L9 13L14 7" stroke="var(--status-idle, #10B981)" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
    );
  }
  if (state === 'active') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ shapeRendering: 'crispEdges', flexShrink: 0 }}>
        <rect x="2" y="2" width="16" height="16" fill="var(--bg-primary)" stroke="var(--accent-primary)" strokeWidth="2" rx="2" />
        <circle cx="10" cy="10" r="4" fill="var(--accent-primary)">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
        </circle>
      </svg>
    );
  }
  if (state === 'failed') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ shapeRendering: 'crispEdges', flexShrink: 0 }}>
        <rect x="2" y="2" width="16" height="16" fill="rgba(239, 68, 68, 0.15)" stroke="var(--status-error)" strokeWidth="2" rx="2" />
        <path d="M6 6L14 14M14 6L6 14" stroke="var(--status-error)" strokeWidth="2" strokeLinecap="square" />
      </svg>
    );
  }
  // Pending
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ shapeRendering: 'crispEdges', flexShrink: 0 }}>
      <rect x="2" y="2" width="16" height="16" fill="var(--bg-primary)" stroke="var(--border-default)" strokeWidth="1.5" rx="2" strokeDasharray="3 2" />
      <circle cx="10" cy="10" r="2" fill="var(--text-secondary)" opacity="0.4" />
    </svg>
  );
};

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

  // Find selected job from sessionJobs or construct fallback
  const selectedJob = sessionJobs?.find((j: BackendJob) => j.id === selectedJobId) || (sessionJobs && sessionJobs.length > 0 ? sessionJobs[0] : null);

  const currentJobId = selectedJob?.id || jobId || 'LOCAL-PAYLOAD';
  const currentStatus = selectedJob?.status || jobStatus || 'spooling';
  const fileName = selectedJob?.filename || filePreview?.name || 'document.pdf';
  const totalPages = selectedJob?.pages || filePreview?.pages || 1;
  const totalCopies = selectedJob?.copies || copies || 1;
  const pos = jobsAhead ?? 1;

  const steps = [
    { key: 'spooling', label: '1. SPOOLING COMPLETED', icon: <Cpu size={16} /> },
    { key: 'rasterizing', label: '2. RASTERIZING PAGES', icon: <Layers size={16} /> },
    { key: 'printing', label: '3. PRINTING IN PROGRESS', icon: <Printer size={16} /> },
    { key: 'completed', label: '4. DISPATCHED TO TRAY', icon: <CheckCircle2 size={16} /> }
  ];

  const getStepStatus = (stepKey: string): 'done' | 'active' | 'pending' | 'failed' => {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, width: '100%' }}>

      {/* Header */}
      <div className="tracker-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            [LIVE_TELEMETRY_TRACKER]
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Real-time CUPS spooling and hardware queue monitor
          </p>
        </div>
        <Button variant="ghost" onClick={reset} leftIcon={<PlusCircle size={16} />} style={{ minHeight: '36px' }}>
          New Submission
        </Button>
      </div>

      {/* Multi-Job Selector Tabs */}
      {sessionJobs && sessionJobs.length > 1 && (
        <div 
          className="job-switcher-tabs" 
          style={{ 
            display: 'flex', 
            gap: '8px', 
            overflowX: 'auto', 
            paddingBottom: '4px', 
            maxWidth: '100%',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {sessionJobs.map((j: BackendJob, index: number) => {
            const isSelected = j.id === currentJobId;
            const jStatus = j.status || 'queued';
            let badgeBg = 'var(--accent-primary)';
            if (jStatus === 'failed') badgeBg = 'var(--status-error)';
            if (jStatus === 'done') badgeBg = 'var(--status-idle, #10B981)';

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
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 800 : 600,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  backgroundColor: isSelected ? 'var(--bg-surface)' : 'var(--bg-primary)',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? '0 0 12px var(--accent-glow)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: badgeBg }} />
                <span>JOB #{index + 1}: {j.filename || 'Doc'}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>[{jStatus.toUpperCase()}]</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Status Container */}
      <div 
        className="card tracker-card"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '2px solid var(--border-default)',
          borderRadius: 'var(--radius-md, 4px)',
          boxShadow: 'var(--shadow-paper)',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {/* Status Badge Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={22} color="var(--accent-primary)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase' }}>
              STATUS: <span style={{ color: currentStatus === 'failed' ? 'var(--status-error)' : currentStatus === 'done' ? 'var(--status-idle, #10B981)' : 'var(--accent-primary)' }}>{currentStatus}</span>
            </span>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            QUEUE_POSITION: <span className="data-mono" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>#{pos}</span>
          </div>
        </div>

        {/* Vertical Factory Assembly Line Pipeline */}
        <div 
          className="vertical-pipeline-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: '4px'
          }}
        >
          {steps.map((step) => {
            const stepState = getStepStatus(step.key);
            let textColor = 'var(--text-secondary)';
            let fontWeight = 400;

            if (stepState === 'done') {
              textColor = 'var(--text-primary)';
              fontWeight = 700;
            } else if (stepState === 'active') {
              textColor = 'var(--accent-primary)';
              fontWeight = 800;
            } else if (stepState === 'failed') {
              textColor = 'var(--status-error)';
              fontWeight = 700;
            }

            return (
              <div 
                key={step.key} 
                className="pipeline-step"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: textColor,
                  fontWeight
                }}
              >
                <PipelineStatusIndicator state={stepState} />
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {step.icon}
                  {step.label}
                </span>
                {stepState === 'active' && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', marginLeft: 'auto', animation: 'pulseLed 1.2s infinite' }}>
                    [PROCESSING]
                  </span>
                )}
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
              padding: '12px 16px',
              borderRadius: '4px',
              color: 'var(--status-error)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              <span>Hardware jam or CUPS spooling timeout.</span>
            </div>
            <Button variant="danger" onClick={reset} style={{ minHeight: '36px', padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
              EJECT & RETRY
            </Button>
          </div>
        )}

        {/* Monospace Metadata Card */}
        <div 
          style={{
            backgroundColor: 'var(--bg-surface-alt)',
            border: '1px solid var(--border-default)',
            padding: '12px 16px',
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-default)', paddingBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>PAYLOAD UUID</span>
            <span 
              className="data-mono" 
              style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: 'var(--text-primary)', 
                maxWidth: '180px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}
            >
              {currentJobId}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-default)', paddingBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>FILE</span>
            <span 
              className="data-mono" 
              style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: 'var(--text-primary)', 
                maxWidth: '180px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}
            >
              {fileName}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SPECS</span>
            <span className="data-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
              {totalPages} PAGES • {totalCopies} COPIES
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
