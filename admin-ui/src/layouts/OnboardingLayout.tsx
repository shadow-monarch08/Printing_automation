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

interface OnboardingLayoutProps {
  mode?: 'full' | 'wifi-only';
}

export function OnboardingLayout({ mode = 'full' }: OnboardingLayoutProps) {
  const isWifiOnly = mode === 'wifi-only';
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(isWifiOnly ? 2 : 1);
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
            <span>
              {isWifiOnly 
                ? 'SYSTEM_MAINTENANCE // WI-FI_RECONFIGURATION' 
                : 'SYSTEM_PROVISIONING // TERMINAL_INITIALIZATION'}
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            {isWifiOnly 
              ? `[STEP 0${currentStep === 2 ? 1 : 1}/01]`
              : `[STEP 0${currentStep}/02]`}
          </div>
        </div>

        {/* Stepper Bar */}
        {isWifiOnly ? (
          <div className="onboarding-stepper-bar" style={{ gridTemplateColumns: '1fr' }}>
            <div className={`onboarding-step-tab ${currentStep === 2 ? 'active' : 'completed'}`}>
              <span>1. NETWORK PROVISIONING</span>
              {currentStep === 2 && <span className="led-diode amber" />}
              {currentStep === 3 && <span>[✓]</span>}
            </div>
          </div>
        ) : (
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
        )}

        {/* Step Views */}
        <div style={{ padding: '24px' }}>
          {currentStep === 1 && !isWifiOnly && (
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
              mode={mode}
            />
          )}

          {currentStep === 3 && (
            <Step3Completion mode={mode} />
          )}
        </div>
      </div>
    </div>
  );
}
