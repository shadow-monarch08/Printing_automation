// src/components/kiosk/telemetry/KioskProvisioningHUD.tsx
import React, { useEffect } from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { api } from '../../../services/api';
import { AlertCircle, RefreshCw, ChevronLeft } from 'lucide-react';
import { TouchKey } from '../keyboard/TouchKey';

export const KioskProvisioningHUD: React.FC = () => {
  const {
    provisioningTelemetry,
    errorMessage,
    errorCode,
    selectedNetwork,
    onboardingMode,
    startScreenMode,
    setTelemetry,
    setErrorMessage,
    setStep,
    submitProvisioning,
    fetchSummary,
  } = useKioskStore();

  // 1. SSE Stream for Real-time Hardware Telemetry
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/setup/provision-stream');
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.status) {
            setTelemetry(parsed);
            if (parsed.status === 'success') {
              fetchSummary();
            } else if (parsed.status === 'failed') {
              setErrorMessage(parsed.error || 'Connection failed', parsed.code || 'HARDWARE_FAULT');
            }
          }
        } catch {
          /* ignore heartbeats */
        }
      };

      eventSource.onerror = () => {
        if (eventSource) eventSource.close();
      };
    } catch (err) {
      console.warn('[ProvisioningHUD] SSE not supported:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [setTelemetry, setErrorMessage, fetchSummary]);

  // 2. Polling Fallback
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const tel = await api.getProvisionStatus();
        if (tel && tel.status) {
          setTelemetry(tel);
          if (tel.status === 'success') {
            fetchSummary();
          } else if (tel.status === 'failed') {
            setErrorMessage(tel.error || 'Connection failed', tel.code || 'HARDWARE_FAULT');
          }
        }
      } catch (err) {
        /* ignore polling errors */
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [setTelemetry, setErrorMessage, fetchSummary]);

  const isFailed =
    Boolean(errorMessage) ||
    provisioningTelemetry?.status === 'failed' ||
    Boolean(errorCode);

  const isMobileMode =
    provisioningTelemetry?.retryMode === 'MOBILE' ||
    provisioningTelemetry?.onboardingMode === 'MOBILE' ||
    onboardingMode === 'MOBILE';

  // Auto-revert back to MOBILE_HANDOFF if provisioning in mobile mode failed
  useEffect(() => {
    if (isFailed && isMobileMode) {
      const timer = setTimeout(() => {
        setStep('MOBILE_HANDOFF');
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isFailed, isMobileMode, setStep]);

  const getHumanFriendlyError = () => {
    const code = errorCode || provisioningTelemetry?.code;
    if (code === 'WIFI_AUTH_FAILED') return 'Incorrect Wi-Fi password. Please check your password and try again.';
    if (code === 'WIFI_NOT_FOUND') return 'Wi-Fi network was not found. Please ensure the router is turned on.';
    if (code === 'WIFI_TIMEOUT') return 'Wi-Fi connection timed out. The router took too long to respond.';
    if (code === 'NO_INTERNET') return 'Connected to Wi-Fi, but no internet access was detected.';
    return errorMessage || provisioningTelemetry?.error || 'Could not connect to the network. Please try again.';
  };

  const getHumanFriendlyStepMessage = () => {
    const step = provisioningTelemetry?.step || 1;
    switch (step) {
      case 1:
        return `Connecting to "${selectedNetwork?.ssid || 'Wi-Fi'}"...`;
      case 2:
        return 'Verifying internet connection...';
      case 3:
        return 'Connecting to cloud printing network...';
      case 4:
      default:
        return 'Finishing kiosk configuration...';
    }
  };

  const progressPercent = Math.min(100, Math.max(15, provisioningTelemetry?.progressPercent || 25));

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '28px 36px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      {/* 1. Header */}
      <div>
        <h2
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: isFailed ? '#EF4444' : '#FFFFFF',
            margin: '0 0 4px 0',
          }}
        >
          {isFailed ? 'Connection Issue' : 'Setting up your Kiosk'}
        </h2>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
          {isFailed
            ? 'We encountered an issue while connecting your kiosk.'
            : 'Please wait a moment while we configure your printer kiosk.'}
        </p>
      </div>

      {/* 2. Main Status Card */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {!isFailed ? (
          <div
            style={{
              background: '#24282D',
              border: '1.5px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>
                {getHumanFriendlyStepMessage()}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#FF5500' }}>
                {progressPercent}%
              </div>
            </div>

            {/* Smooth Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '12px',
                background: '#1A1D20',
                borderRadius: '6px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: '#10B981',
                  transition: 'width 0.4s ease-in-out',
                }}
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1.5px solid #EF4444',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444' }}>
              <AlertCircle size={22} />
              <span style={{ fontSize: '16px', fontWeight: 700 }}>
                Unable to Connect
              </span>
            </div>

            <div style={{ fontSize: '14px', color: '#FFFFFF', lineHeight: '1.5' }}>
              {getHumanFriendlyError()}
            </div>

            {isMobileMode && (
              <div
                style={{
                  marginTop: '4px',
                  padding: '8px 12px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '6px',
                  color: '#38BDF8',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                📶 Hotspot re-enabled. Returning to QR Code screen in 3 seconds...
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Action Buttons on Error */}
      {isFailed && (
        <div style={{ display: 'flex', gap: '12px' }}>
          {isMobileMode ? (
            <>
              <TouchKey
                label={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}>
                    <ChevronLeft size={18} />
                    <span>Return to QR Code Now</span>
                  </div>
                }
                variant="secondary"
                height="50px"
                flex={1.2}
                onClick={() => setStep('MOBILE_HANDOFF')}
              />

              <TouchKey
                label="Switch to On-Screen Setup ➔"
                variant="action"
                height="50px"
                flex={1.5}
                onClick={startScreenMode}
              />
            </>
          ) : (
            <>
              <TouchKey
                label={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}>
                    <ChevronLeft size={18} />
                    <span>Choose Another Network</span>
                  </div>
                }
                variant="secondary"
                height="50px"
                flex={1.2}
                onClick={() => setStep('WIFI_SCAN')}
              />

              <TouchKey
                label={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}>
                    <RefreshCw size={18} />
                    <span>Try Again</span>
                  </div>
                }
                variant="action"
                height="50px"
                flex={1.5}
                onClick={submitProvisioning}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};
