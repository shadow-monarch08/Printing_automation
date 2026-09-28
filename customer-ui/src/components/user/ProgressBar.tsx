import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { Button } from '../shared/Button';

const steps = [
  { full: '1. UPLOAD', short: '1. UP' },
  { full: '2. CONFIG', short: '2. CFG' },
  { full: '3. QUOTE', short: '3. QTE' },
  { full: '4. TRACKER', short: '4. TRK' },
];

export function ProgressBar() {
  const { currentStep, goToStep } = useUserPrintStore();

  return (
    <div 
      className="progress-container"
      style={{
        display: 'flex',
        gap: '8px',
        margin: '0 0 1.5rem 0',
        width: '100%'
      }}
    >
      {steps.map((stepObj, index) => {
        const stepNum = index + 1;
        const isActive = currentStep === stepNum;
        const isPast = currentStep > stepNum;
        
        let stateClass = 'progress-step--default';
        if (isActive) stateClass = 'progress-step--active';
        else if (isPast) stateClass = 'progress-step--past';

        return (
          <Button
            key={stepNum}
            variant={isActive ? 'mechanical' : 'ghost'}
            className={`progress-step ${stateClass}`}
            onClick={() => {
              if (isPast) {
                goToStep(stepNum as any);
              }
            }}
            disabled={!isPast && !isActive}
            style={{
              flex: 1,
              minHeight: '44px',
              padding: '0.5rem 0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: isActive ? 800 : 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderRadius: '2px',
              cursor: isPast ? 'pointer' : 'default',
              boxSizing: 'border-box'
            }}
          >
            <span className="step-label-full">{stepObj.full}</span>
            <span className="step-label-short" style={{ display: 'none' }}>{stepObj.short}</span>
          </Button>
        );
      })}

      <style>{`
        @media (max-width: 480px) {
          .step-label-full { display: none !important; }
          .step-label-short { display: inline !important; }
        }
      `}</style>
    </div>
  );
}
