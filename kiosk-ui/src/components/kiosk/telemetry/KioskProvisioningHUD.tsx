// src/components/kiosk/telemetry/KioskProvisioningHUD.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { api } from '../../../services/api';
import { AlertTriangle, RefreshCw, ChevronLeft, ArrowRight } from 'lucide-react';
import { Button } from '../../shared/Button';

export const KioskProvisioningHUD: React.FC = () => {
  const {
    provisioningTelemetry,
    errorMessage,
    errorCode,
    onboardingMode,
    startScreenMode,
    setTelemetry,
    setErrorMessage,
    setStep,
    submitProvisioning,
    fetchSummary,
    kioskSummary,
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

  // 2. Initial status check on mount if telemetry is null (subsequent updates handled by WebSocket)
  useEffect(() => {
    if (!provisioningTelemetry) {
      api.getProvisionStatus().then((tel) => {
        if (tel && tel.status) {
          setTelemetry(tel);
        }
      }).catch(() => {});
    }
  }, [provisioningTelemetry, setTelemetry]);

  const isFailed =
    Boolean(errorMessage) ||
    provisioningTelemetry?.status === 'failed' ||
    Boolean(errorCode);

  const isMobileMode =
    provisioningTelemetry?.retryMode === 'MOBILE' ||
    provisioningTelemetry?.onboardingMode === 'MOBILE' ||
    onboardingMode === 'MOBILE';

  const [secondsRemaining, setSecondsRemaining] = useState(15);

  const handleBack = useCallback(() => {
    setErrorMessage(null);
    if (kioskSummary?.isOnboarded) {
      setStep('OPERATIONAL');
    } else if (isMobileMode) {
      setStep('MOBILE_HANDOFF');
    } else {
      setStep('WIFI_SCAN');
    }
  }, [kioskSummary?.isOnboarded, isMobileMode, setErrorMessage, setStep]);

  // 15-second countdown before auto-triggering return to QR / Wi-Fi list
  useEffect(() => {
    if (!isFailed) {
      setSecondsRemaining(15);
      return;
    }

    setSecondsRemaining(15);
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleBack();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isFailed, handleBack]);

  const getHumanFriendlyError = () => {
    const code = errorCode || provisioningTelemetry?.code;
    if (code === 'WIFI_AUTH_FAILED') return 'Incorrect Wi-Fi password. Please verify security key.';
    if (code === 'WIFI_SAVED_PROFILE_EXPIRED') return 'Saved network password changed. Please enter manually.';
    if (code === 'WIFI_NETWORK_NOT_FOUND' || code === 'SSID_NOT_FOUND') return 'Wi-Fi network out of range or not broadcasting.';
    if (code === 'WIFI_DHCP_FAILED' || code === 'DHCP_TIMEOUT') return 'Router failed to assign IP address (DHCP error).';
    if (code === 'WIFI_RADIO_BLOCKED') return 'Wireless radio is disabled or blocked on device.';
    if (code === 'WIFI_INTERRUPTED') return 'Wireless radio was interrupted during mode transition.';
    if (code === 'NO_INTERNET') return 'Connected to Wi-Fi, but no internet access detected.';
    if (code === 'TUNNEL_FAILED') return 'Internet connected, but cloud edge tunnel failed to initialize.';
    return 'Could not connect to Wi-Fi. Please check router and retry.';
  };

  const getPhasePill = () => {
    const phase = provisioningTelemetry?.phase || 'CONNECTING';
    return `[ ${phase} ]`;
  };

  const progressPercent = Math.min(
    100,
    Math.max(
      15,
      provisioningTelemetry?.progressPercent ||
        (provisioningTelemetry?.phase === 'CYCLING_RADIO_HARDWARE'
          ? 25
          : provisioningTelemetry?.phase === 'NEGOTIATING_WAN_DHCP_LEASE'
          ? 55
          : provisioningTelemetry?.phase === 'SPAWNING_CLOUDFLARE_EDGE_TUNNEL'
          ? 85
          : provisioningTelemetry?.status === 'success'
          ? 100
          : 30)
    )
  );

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* 1. Big Punchy Header Strip (No subtitles) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '22px',
            fontWeight: 800,
            color: isFailed ? 'var(--status-error, #FF4444)' : 'var(--text-primary)',
            margin: 0,
            letterSpacing: '0.02em',
          }}
        >
          {isFailed ? 'CONNECTION FAILED' : 'CONNECTING HARDWARE...'}
        </h1>

        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '11px',
            fontWeight: 700,
            color: isFailed ? 'var(--status-error, #FF4444)' : 'var(--accent-primary)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm, 2px)',
          }}
        >
          {isFailed ? '[FAULT_STATE]' : getPhasePill()}
        </span>
      </div>

      {/* 2. Main Central Graphic Card */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '8px 0' }}>
        {!isFailed ? (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '2px solid var(--border-default)',
              borderRadius: 'var(--radius-lg, 6px)',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow-paper)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {provisioningTelemetry?.message || 'Configuring Wi-Fi radio and acquiring network lease...'}
              </div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: 'var(--accent-primary)',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {progressPercent}%
              </div>
            </div>

            {/* High-Contrast Industrial Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '14px',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm, 2px)',
                border: '1px solid var(--border-default)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: 'var(--accent-primary)',
                  transition: 'width 0.4s ease-in-out',
                }}
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '2px solid var(--status-error, #FF4444)',
              borderRadius: 'var(--radius-lg, 6px)',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'var(--shadow-paper)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--status-error, #FF4444)' }}>
              <AlertTriangle size={24} />
              <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.04em' }}>
                CONNECTION FAILED
              </span>
            </div>

            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.4,
                fontFamily: 'var(--font-body)',
              }}
            >
              {getHumanFriendlyError()}
            </div>
          </div>
        )}
      </div>

      {/* 3. Huge Action Buttons on Error with 15s Progress Overlay */}
      {isFailed && (
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          {kioskSummary?.isOnboarded ? (
            <button
              onClick={handleBack}
              style={{
                position: 'relative',
                overflow: 'hidden',
                width: '100%',
                height: '52px',
                background: 'var(--bg-surface)',
                border: '2px solid var(--accent-primary)',
                borderRadius: 'var(--radius-md, 4px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 16px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.min(100, Math.max(0, ((15 - secondsRemaining) / 15) * 100))}%`,
                  background: 'rgba(255, 85, 0, 0.25)',
                  transition: 'width 1s linear',
                  zIndex: 0,
                }}
              />
              <span
                style={{
                  position: 'relative',
                  zIndex: 1,
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '14px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                RETURN TO TERMINAL ({secondsRemaining}s) ➔
              </span>
            </button>
          ) : isMobileMode ? (
            <>
              <button
                onClick={handleBack}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  flex: 1.2,
                  height: '52px',
                  background: 'var(--bg-surface)',
                  border: '2px solid var(--accent-primary)',
                  borderRadius: 'var(--radius-md, 4px)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 16px',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(100, Math.max(0, ((15 - secondsRemaining) / 15) * 100))}%`,
                    background: 'rgba(255, 85, 0, 0.25)',
                    transition: 'width 1s linear',
                    zIndex: 0,
                  }}
                />
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '14px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <ChevronLeft size={18} />
                  RETURN TO QR ({secondsRemaining}s)
                </span>
              </button>

              <Button
                variant="primary"
                rightIcon={<ArrowRight size={18} />}
                style={{ flex: 1.2, height: '52px', fontSize: '14px', fontWeight: 800 }}
                onClick={startScreenMode}
              >
                CONFIGURE ON SCREEN ➔
              </Button>
            </>
          ) : (
            <>
              <button
                onClick={handleBack}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  flex: 1.2,
                  height: '52px',
                  background: 'var(--bg-surface)',
                  border: '2px solid var(--accent-primary)',
                  borderRadius: 'var(--radius-md, 4px)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 16px',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(100, Math.max(0, ((15 - secondsRemaining) / 15) * 100))}%`,
                    background: 'rgba(255, 85, 0, 0.25)',
                    transition: 'width 1s linear',
                    zIndex: 0,
                  }}
                />
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '14px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <ChevronLeft size={18} />
                  BACK TO WI-FI ({secondsRemaining}s)
                </span>
              </button>

              <Button
                variant="primary"
                leftIcon={<RefreshCw size={18} />}
                style={{ flex: 1.2, height: '52px', fontSize: '14px', fontWeight: 800 }}
                onClick={() => submitProvisioning()}
              >
                RETRY NOW ➔
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
