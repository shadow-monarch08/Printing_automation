// src/pages/kiosk/KioskTerminalHub.tsx
import React, { useEffect, useState } from 'react';
import { useKioskStore } from '../../stores/useKioskStore';
import { KioskLayout } from '../../layouts/KioskLayout';
import { KioskModeChoiceStep } from '../../components/kiosk/onboarding/KioskModeChoiceStep';
import { KioskMobileHandoffStep } from '../../components/kiosk/onboarding/KioskMobileHandoffStep';
import { KioskIdentityStep } from '../../components/kiosk/onboarding/KioskIdentityStep';
import { KioskWifiStep } from '../../components/kiosk/onboarding/KioskWifiStep';
import { KioskProvisioningHUD } from '../../components/kiosk/telemetry/KioskProvisioningHUD';
import { KioskOperationalHUD } from '../../components/kiosk/telemetry/KioskOperationalHUD';
import { LoadingNet } from '../../components/shared/LoadingNet';

export const KioskTerminalHub: React.FC = () => {
  const {
    step,
    kioskSummary,
    fetchSummary,
  } = useKioskStore();

  const [initialLoading, setInitialLoading] = useState(true);

  // 1. Initial Hardware Chassis Summary Fetch
  useEffect(() => {
    fetchSummary().finally(() => setInitialLoading(false));

    // Periodic summary sync every 5 seconds
    const interval = setInterval(fetchSummary, 5000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  // Loading Screen using Primitive Custom Component
  if (initialLoading && !kioskSummary) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: 'var(--bg-primary, #1A1D20)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'none',
        }}
      >
        <LoadingNet message="INITIALIZING_HARDWARE_SUBSYSTEMS..." />
      </div>
    );
  }

  // 2. Step Router for 800x480 Physical Screen
  const renderCurrentStep = () => {
    switch (step) {
      case 'CHOICE':
        return <KioskModeChoiceStep />;
      case 'MOBILE_HANDOFF':
        return <KioskMobileHandoffStep />;
      case 'IDENTITY':
        return <KioskIdentityStep />;
      case 'WIFI_SCAN':
        return <KioskWifiStep />;
      case 'PROVISIONING':
        return <KioskProvisioningHUD />;
      case 'OPERATIONAL':
      default:
        return <KioskOperationalHUD summary={kioskSummary} onRefresh={fetchSummary} />;
    }
  };

  return (
    <KioskLayout>
      {renderCurrentStep()}
    </KioskLayout>
  );
};
