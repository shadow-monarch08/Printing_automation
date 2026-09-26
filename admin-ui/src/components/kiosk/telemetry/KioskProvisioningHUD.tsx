// src/components/kiosk/telemetry/KioskProvisioningHUD.tsx
import React, { useEffect } from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { api } from '../../../services/api';
import { AlertTriangle, RefreshCw, ChevronLeft } from 'lucide-react';
import { TouchKey } from '../keyboard/TouchKey';

export const KioskProvisioningHUD: React.FC = () => {
  const {
    provisioningTelemetry,
    errorMessage,
    errorCode,
    selectedNetwork,
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
              setErrorMessage(parsed.error || 'Provisioning sequence failed', parsed.code || 'HARDWARE_FAULT');
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

  // 2. Polling Fallback if SSE is delayed or blocked
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const tel = await api.getProvisionStatus();
        if (tel && tel.status) {
          setTelemetry(tel);
          if (tel.status === 'success') {
            fetchSummary();
          } else if (tel.status === 'failed') {
            setErrorMessage(tel.error || 'Provisioning sequence failed', tel.code || 'HARDWARE_FAULT');
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

  const displayError =
    errorMessage || provisioningTelemetry?.error || 'Connection timed out or router rejected key.';
  const displayCode =
    errorCode || provisioningTelemetry?.code || 'AUTHENTICATION_FAILURE';

  const stepNumber = provisioningTelemetry?.step || 1;
  const progressPercent = Math.min(100, Math.max(10, provisioningTelemetry?.progressPercent || 25));
  const activeMessage =
    provisioningTelemetry?.message || 'Executing edge hardware initialization...';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header Status */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span
            className={`led-diode ${isFailed ? 'red' : 'amber'}`}
            style={{ width: '12px', height: '12px', borderRadius: '50%' }}
          />
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, monospace)',
              color: isFailed ? '#EF4444' : 'var(--accent-primary, #FF5500)',
              letterSpacing: '0.04em',
            }}
          >
            {isFailed
              ? '[ PROVISIONING_FAILED // ATTENTION REQUIRED ]'
              : `[ PROVISIONING_IN_PROGRESS // STEP 0${stepNumber}/04 ]`}
          </span>
        </div>

        {/* Target Network Tag */}
        {selectedNetwork?.ssid && (
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              marginBottom: '12px',
            }}
          >
            TARGET_AP: <strong style={{ color: 'var(--text-primary)' }}>[{selectedNetwork.ssid}]</strong>
          </div>
        )}
      </div>

      {/* 2. Middle Body: Progress Bar vs. Error Diagnosis */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {!isFailed ? (
          <div
            style={{
              background: 'var(--bg-surface, #24282D)',
              border: '2px solid var(--border-default, #3A4047)',
              borderRadius: 'var(--radius-md, 6px)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '16px',
                background: '#111315',
                border: '1px solid var(--border-default)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: 'var(--status-idle, #10B981)',
                  transition: 'width 0.4s ease-in-out',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {activeMessage}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--accent-secondary, #00A396)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {progressPercent}%
              </div>
            </div>

            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                borderTop: '1px dashed var(--border-default)',
                paddingTop: '8px',
              }}
            >
              Station interface associating without interrupting local background daemons.
            </div>
          </div>
        ) : (
          /* Error Diagnosis Card */
          <div
            style={{
              background: '#2A1717',
              border: '2px solid #EF4444',
              borderRadius: 'var(--radius-md, 6px)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444' }}>
              <AlertTriangle size={20} />
              <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                HARDWARE_COMMUNICATION_FAULT // [{displayCode}]
              </span>
            </div>

            <div
              style={{
                fontSize: '13px',
                color: '#FFFFFF',
                fontFamily: 'var(--font-mono)',
                lineHeight: '1.5',
              }}
            >
              {displayError}
            </div>

            <div
              style={{
                fontSize: '11px',
                color: '#FFAAAA',
                fontFamily: 'var(--font-mono)',
                borderTop: '1px dashed rgba(239, 68, 68, 0.4)',
                paddingTop: '8px',
              }}
            >
              Station mode maintained on wlan0. You may re-enter your Wi-Fi password or select another network.
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Action Controls (Shown on Error) */}
      {isFailed && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <TouchKey
            label={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <ChevronLeft size={18} />
                <span>PICK ANOTHER NETWORK</span>
              </div>
            }
            variant="secondary"
            height="50px"
            flex={1.2}
            onClick={() => setStep('WIFI_SCAN')}
          />

          <TouchKey
            label={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <RefreshCw size={18} />
                <span>RETRY CONNECTION</span>
              </div>
            }
            variant="action"
            height="50px"
            flex={1.5}
            onClick={submitProvisioning}
          />
        </div>
      )}
    </div>
  );
};
