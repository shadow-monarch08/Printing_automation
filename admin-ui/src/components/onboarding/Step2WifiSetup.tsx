import { useEffect } from 'react';
import { Button } from '../shared/Button';
import { PaperTable } from '../shared/PaperTable';
import { useModal } from '../../context/ModalContext';
import { WifiConnectModalBody } from './WifiConnectModalBody';
import { useAdminStore } from '../../stores/useAdminStore';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import type { WifiNetwork } from '../../types';

interface Step2WifiSetupProps {
  shopName?: string;
  adminPin?: string;
  onComplete?: () => void;
}

export function Step2WifiSetup({ onComplete }: Step2WifiSetupProps) {
  const provisioningState = useAdminStore((s) => s.provisioningState);

  const networks = useOnboardingStore((s) => s.networks);
  const isScanning = useOnboardingStore((s) => s.isScanning);
  const scanNetworks = useOnboardingStore((s) => s.scanNetworks);
  const setSelectedNetwork = useOnboardingStore((s) => s.setSelectedNetwork);
  const isSubmitting = useOnboardingStore((s) => s.isSubmitting);
  const submissionError = useOnboardingStore((s) => s.submissionError);
  const clearSubmissionError = useOnboardingStore((s) => s.clearSubmissionError);
  const skipWifiProvision = useOnboardingStore((s) => s.skipWifiProvision);

  const { openModal, closeModal } = useModal();

  useEffect(() => {
    scanNetworks();
  }, [scanNetworks]);

  const handleNetworkSelect = (network: WifiNetwork) => {
    setSelectedNetwork(network);
    clearSubmissionError();
    openModal({
      title: `CONNECT_TO: [${network.ssid}]`,
      content: <WifiConnectModalBody closeModal={closeModal} />,
      onClose: () => {
        setSelectedNetwork(null);
        clearSubmissionError();
      },
    });
  };

  const handleSkipWifi = async () => {
    const success = await skipWifiProvision();
    if (success && onComplete) {
      onComplete();
    }
  };

  const renderSignalGauge = (signal: number) => {
    const blocks = Math.min(4, Math.max(1, Math.ceil(signal / 25)));
    const filled = '█ '.repeat(blocks);
    const empty = '░ '.repeat(4 - blocks);
    return `[ ${filled}${empty}] ${signal}%`;
  };

  const activeNetworks = networks.filter((n) => n.isActive);
  const availableNetworks = networks.filter((n) => !n.isActive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top-level failure banner if modal was dismissed or skip failed */}
      {submissionError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1.5px solid #EF4444',
            borderRadius: 'var(--radius-sm, 6px)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: '#EF4444' }}>
                SETUP_FAILED // HOTSPOT_RECONNECTED
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                {submissionError}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={clearSubmissionError}
            style={{ height: '32px', fontSize: '11px' }}
          >
            DISMISS
          </Button>
        </div>
      )}

      {/* Top Telemetry Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '16px',
          borderBottom: '1px dashed var(--border-default)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
          WI-FI_RADIO_PROVISIONING
        </div>
        <Button
          variant="ghost"
          onClick={() => scanNetworks()}
          disabled={isScanning || isSubmitting}
          isLoading={isScanning}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', height: '32px' }}
        >
          <span>[ REFRESH SCAN ]</span>
        </Button>
      </div>

      {/* Currently Connected Active Plate */}
      {activeNetworks.length > 0 && (
        <div
          style={{
            background: 'rgba(0, 200, 83, 0.05)',
            border: '2px solid var(--status-idle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="led-diode green" />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeNetworks[0].ssid}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                ACTIVE LINK // {activeNetworks[0].signal}%
              </div>
            </div>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              padding: '2px 8px',
              background: 'var(--status-idle)',
              color: '#000',
              fontWeight: 700,
            }}
          >
            [ACTIVE_LINK]
          </span>
        </div>
      )}

      {/* Available Networks Matrix */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          AVAILABLE_NETWORKS_MATRIX
        </div>
        <PaperTable style={{ margin: 0, padding: 0 }}>
          {isScanning && networks.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              SWEEPING 2.4GHz / 5GHz FREQUENCIES...
            </div>
          ) : availableNetworks.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              NO ADDITIONAL ACCESS POINTS DETECTED.
            </div>
          ) : (
            availableNetworks.map((net) => (
              <div
                key={net.ssid}
                className="wifi-network-item-row"
                onClick={() => !isSubmitting && handleNetworkSelect(net)}
                style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="led-diode amber" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {net.ssid}
                  </span>
                  {net.isSaved && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        padding: '1px 6px',
                        background: 'rgba(0, 200, 83, 0.15)',
                        border: '1px solid var(--status-idle)',
                        color: 'var(--status-idle)',
                      }}
                    >
                      [SAVED_PROFILE]
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-secondary)' }}>
                    {renderSignalGauge(net.signal)}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={isSubmitting}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', height: '28px', padding: '0 8px' }}
                  >
                    [ SELECT ➔ ]
                  </Button>
                </div>
              </div>
            ))
          )}
        </PaperTable>

        {/* Skip Wi-Fi Setup Option (Strictly Available Only in Recovery Mode) */}
        {provisioningState === 'RECOVERY' && (
          <Button
            variant="ghost"
            onClick={handleSkipWifi}
            disabled={isSubmitting}
            isLoading={isSubmitting}
            style={{
              width: '100%',
              height: '44px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              marginTop: '16px',
              border: '1px dashed var(--border-default)',
              color: 'var(--text-secondary)',
            }}
          >
            {isSubmitting
              ? '[ VERIFYING ACTIVE NETWORK GATEWAY... ]'
              : '[ PROCEED WITH CURRENT ACTIVE NETWORK (SKIP WI-FI SETUP) ➔ ]'}
          </Button>
        )}
      </div>
    </div>
  );
}
