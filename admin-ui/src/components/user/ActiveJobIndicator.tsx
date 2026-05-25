import { useState } from 'react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { useSessionJobs } from '../../hooks/useSessionJobs';
import { Layers, ChevronUp, ChevronDown } from 'lucide-react';

export function ActiveJobIndicator() {
  const { currentStep, goToStep } = useUserPrintStore();
  const jobs = useSessionJobs(10000);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const activeJobs = jobs.filter(j => ['queued', 'spooling', 'printing'].includes(j.status));

  // Only show if there are active jobs and we are NOT already on the Job Tracker step
  if (activeJobs.length === 0 || currentStep === 4) return null;

  return (
    <div 
      style={{ 
        position: 'fixed', 
        bottom: '20px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <div 
        className="card"
        style={{ 
          padding: isExpanded ? '1rem' : '0.5rem 1rem',
          borderRadius: '24px',
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          gap: isExpanded ? '1rem' : '0',
          cursor: isExpanded ? 'default' : 'pointer',
          width: isExpanded ? '340px' : '160px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          border: '1px solid var(--border-active)',
          backgroundColor: 'var(--bg-surface)',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          overflow: 'hidden'
        }}
        onClick={() => {
          if (!isExpanded) setIsExpanded(true);
        }}
      >
        {/* Header / Collapsed view */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            width: '100%',
            cursor: 'pointer'
          }}
          onClick={(e) => {
            if (isExpanded) {
              e.stopPropagation();
              setIsExpanded(false);
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-primary)', flex: 1, justifyContent: isExpanded ? 'flex-start' : 'center' }}>
            <Layers size={20} color="var(--status-idle)" style={{ animation: 'pulseGlow 2s infinite' }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
              {activeJobs.length} Active {activeJobs.length === 1 ? 'Job' : 'Jobs'}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
            {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </div>
        </div>

        {/* Expanded Details */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            width: '100%',
            opacity: isExpanded ? 1 : 0,
            maxHeight: isExpanded ? '60px' : '0px',
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            pointerEvents: isExpanded ? 'auto' : 'none'
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Processing in background</div>
          <button 
            className="btn-mechanical" 
            onClick={(e) => {
              e.stopPropagation();
              goToStep(4);
            }} 
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            View Status
          </button>
        </div>
      </div>
    </div>
  );
}
