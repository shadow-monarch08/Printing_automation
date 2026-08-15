import { useState, useCallback } from 'react';
import { Step1NameAndPin } from '../components/onboarding/Step1NameAndPin';
import { Step2WifiSetup } from '../components/onboarding/Step2WifiSetup';
import { Step3Completion } from '../components/onboarding/Step3Completion';

export interface OnboardingData {
  shopName: string;
  adminPin: string;
  wifiSsid?: string;
  wifiPassword?: string;
}

export function OnboardingLayout() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    shopName: 'Modern Press',
    adminPin: '',
  });

  const handleStep1Complete = useCallback((shopName: string, adminPin: string) => {
    setOnboardingData(prev => ({ ...prev, shopName, adminPin }));
    setCurrentStep(2);
  }, []);

  const handleStep2Complete = useCallback(() => {
    setCurrentStep(3);
  }, []);

  return (
    <div className="onboarding-canvas">
      <div className="onboarding-console-card">
        {/* Header Strip */}
        <div className="onboarding-header-strip">
          <div className="onboarding-header-title">
            <span className="led-diode green" />
            <span>SYSTEM_PROVISIONING // TERMINAL_INITIALIZATION</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            [STEP 0{currentStep}/02]
          </div>
        </div>

        {/* Stepper Bar */}
        <div className="onboarding-stepper-bar">
          <div className={`onboarding-step-tab ${currentStep === 1 ? 'active' : 'completed'}`}>
            <span>1. IDENTITY & SECURITY</span>
            {currentStep > 1 && <span>[✓]</span>}
          </div>
          <div className={`onboarding-step-tab ${currentStep === 2 ? 'active' : currentStep === 3 ? 'completed' : ''}`}>
            <span>2. NETWORK PROVISIONING</span>
            {currentStep === 2 && <span className="led-diode amber" />}
            {currentStep === 3 && <span>[✓]</span>}
          </div>
        </div>

        {/* Step Views */}
        <div style={{ padding: '24px' }}>
          {currentStep === 1 && (
            <Step1NameAndPin
              initialShopName={onboardingData.shopName}
              onComplete={handleStep1Complete}
            />
          )}

          {currentStep === 2 && (
            <Step2WifiSetup
              shopName={onboardingData.shopName}
              adminPin={onboardingData.adminPin}
              onComplete={handleStep2Complete}
            />
          )}

          {currentStep === 3 && (
            <Step3Completion />
          )}
        </div>
      </div>
    </div>
  );
}

