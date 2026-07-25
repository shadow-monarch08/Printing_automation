import { useState } from 'react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { useSessionJobs } from '../../hooks/useSessionJobs';
import { ChevronUp, ChevronDown, ArrowRight } from 'lucide-react';
import { soundFx } from '../../utils/sound';
import { Button } from '../shared/Button';

export function ActiveJobIndicator() {
  const { currentStep, goToStep } = useUserPrintStore();
  const jobs = useSessionJobs(10000);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const activeJobs = jobs.filter(j => ['queued', 'spooling', 'printing'].includes(j.status));

  if (activeJobs.length === 0 || currentStep === 4) return null;

  return (
    <div 
      className="active-job-indicator-wrapper"
      style={{ 
        position: 'fixed', 
        bottom: '24px', 
        right: '24px', 
        zIndex: 500
      }}
    >
      <div 
        className="card active-job-indicator-card"
        style={{ 
          padding: isExpanded ? '16px' : '8px 16px',
          borderRadius: 'var(--radius-md, 4px)',
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          gap: isExpanded ? '12px' : '0',
          cursor: isExpanded ? 'default' : 'pointer',
          width: isExpanded ? '320px' : 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--accent-primary)',
          border: '2px solid var(--accent-primary)',
          backgroundColor: 'var(--bg-surface)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
        onClick={() => {
          if (!isExpanded) {
            soundFx.playClick();
            setIsExpanded(true);
          }
        }}
      >
        {/* Header / Collapsed view */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            width: '100%',
            cursor: 'pointer',
            gap: '12px'
          }}
          onClick={(e) => {
            if (isExpanded) {
              e.stopPropagation();
              soundFx.playClick();
              setIsExpanded(false);
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <div 
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--status-idle, #10B981)',
                boxShadow: '0 0 8px var(--status-idle, #10B981)',
                animation: 'pulseLed 1.5s infinite alternate'
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.05em' }}>
              [{activeJobs.length} ACTIVE {activeJobs.length === 1 ? 'JOB' : 'JOBS'}]
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
            {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              width: '100%',
              paddingTop: '8px',
              borderTop: '1px dashed var(--border-default)',
              gap: '12px'
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              BACKGROUND_QUEUE
            </div>


            <Button 
              variant="mechanical" 
              onClick={(e) => {
                e.stopPropagation();
                goToStep(4);
              }} 
              rightIcon={<ArrowRight size={14} />}
              style={{ 
                padding: '6px 12px', 
                fontSize: '0.75rem', 
                fontFamily: 'var(--font-mono)', 
                fontWeight: 800
              }}
            >
              TRACKER
            </Button>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .active-job-indicator-wrapper {
            position: fixed !important;
            left: 12px !important;
            right: 12px !important;
            bottom: 12px !important;
            height: 48px !important;
            z-index: 450 !important;
          }
          .active-job-indicator-card {
            width: 100% !important;
            min-height: 48px !important;
            border-radius: 4px !important;
            background: rgba(36, 40, 45, 0.95) !important;
            backdrop-filter: blur(8px) !important;
            border: 1px solid var(--accent-primary) !important;
            padding: 0 12px !important;
          }
        }
      `}</style>
    </div>
  );
}
