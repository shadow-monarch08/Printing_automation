// src/components/kiosk/telemetry/KioskProvisioningHUD.tsx
import React, { useEffect } from 'react';
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
    if (code === 'WIFI_AUTH_FAILED') return 'Incorrect Wi-Fi password. Please check your credentials.';
    if (code === 'SSID_NOT_FOUND') return 'Wi-Fi network signal lost. Ensure router is powered on.';
    if (code === 'DHCP_TIMEOUT') return 'Could not obtain IP address from router (DHCP timeout).';
    if (code === 'NO_INTERNET') return 'Connected to Wi-Fi, but no WAN internet connection detected.';
    return errorMessage || provisioningTelemetry?.error || 'Hardware connection fault encountered.';
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
              padding: '22px 26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'var(--shadow-paper)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--status-error, #FF4444)' }}>
              <AlertTriangle size={24} />
              <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)' }}>
                DIAGNOSTIC ALERT
              </span>
            </div>

            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.4,
                fontFamily: 'var(--font-body)',
              }}
            >
              {getHumanFriendlyError()}
            </div>

            {isMobileMode && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm, 2px)',
                  color: 'var(--status-idle, #00FF88)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 700,
                }}
              >
                📶 Hotspot re-enabled. Returning to QR Code in 3 seconds...
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Huge Action Buttons on Error */}
      {isFailed && (
        <div style={{ display: 'flex', gap: '12px' }}>
          {isMobileMode ? (
            <>
              <Button
                variant="ghost"
                leftIcon={<ChevronLeft size={18} />}
                style={{ flex: 1, height: '52px', fontSize: '14px', fontWeight: 700 }}
                onClick={() => setStep('MOBILE_HANDOFF')}
              >
                [ RETURN TO QR ]
              </Button>

              <Button
                variant="primary"
                rightIcon={<ArrowRight size={18} />}
                style={{ flex: 1.4, height: '52px', fontSize: '14px', fontWeight: 800 }}
                onClick={startScreenMode}
              >
                USE ON-SCREEN INSTEAD ➔
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                leftIcon={<ChevronLeft size={18} />}
                style={{ flex: 1, height: '52px', fontSize: '14px', fontWeight: 700 }}
                onClick={() => setStep('WIFI_SCAN')}
              >
                [ CHOOSE ANOTHER NETWORK ]
              </Button>

              <Button
                variant="primary"
                leftIcon={<RefreshCw size={18} />}
                style={{ flex: 1.4, height: '52px', fontSize: '14px', fontWeight: 800 }}
                onClick={() => submitProvisioning()}
              >
                RETRY CONNECTION ➔
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
