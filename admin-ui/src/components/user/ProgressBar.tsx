// src/components/user/ProgressBar.tsx
import { useUserPrintStore } from '../../stores/useUserPrintStore';

const steps = ['Upload', 'Configure', 'Confirm', 'Status'];

export function ProgressBar() {
  const { currentStep } = useUserPrintStore();

  return (
    <div className="progress-container">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isActive = currentStep === stepNum;
        const isPast = currentStep > stepNum;
        
        let stateClass = 'progress-step--default';
        if (isActive) stateClass = 'progress-step--active';
        else if (isPast) stateClass = 'progress-step--past';

        return (
          <div key={stepNum} className={`progress-step ${stateClass}`}>
            {step}
          </div>
        );
      })}
    </div>
  );
}
