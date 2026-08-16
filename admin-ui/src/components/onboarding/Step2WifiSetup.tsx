import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../shared/Button';
import { PaperTable } from '../shared/PaperTable';
import { useModal } from '../../context/ModalContext';
import { WifiConnectModalBody } from './WifiConnectModalBody';
import { api } from '../../services/api';
import { useAdminStore } from '../../stores/useAdminStore';
import type { WifiNetwork } from '../../types';

interface Step2WifiSetupProps {
  shopName: string;
  adminPin: string;
  onComplete: () => void;
}

export function Step2WifiSetup({ shopName, adminPin, onComplete }: Step2WifiSetupProps) {
  const provisioningState = useAdminStore((s) => s.provisioningState);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedSsid, setSelectedSsid] = useState('');
  const [connectProgress, setConnectProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<'CONNECTING' | 'VERIFYING_INTERNET' | 'STARTING_TUNNEL' | 'TRANSITION'>('CONNECTING');

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const { openModal, closeModal } = useModal();

  const fetchNetworks = async () => {
    setIsScanning(true);
    try {
      const data = await api.scanWifiNetworks();
      setNetworks(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    fetchNetworks();
  }, []);

  const handleNetworkSelect = (network: WifiNetwork) => {
    setSelectedSsid(network.ssid);
    openModal({
      title: `CONNECT_TO: [${network.ssid}]`,
      content: (
        <WifiConnectModalBody
          ssid={network.ssid}
          isSaved={network.isSaved}
          closeModal={closeModal}
          onSubmit={(password) => handleConnectSubmit(network.ssid, password, network.isSaved, network.profileName || undefined)}
        />
      ),
    });
  };

  const handleConnectSubmit = async (ssid: string, password?: string, isSaved?: boolean, profileName?: string) => {
    setIsSubmitting(true);

    try {
      const res = await api.provisionSetup({
        wifiSsid: ssid,
        wifiPassword: password,
        profileName,
        isSaved,
        adminPin,
        shopName,
      });

      if (res?.handoffToken) {
        try {
          localStorage.setItem('onboarding_handoff_token', res.handoffToken);
        } catch {
          /* ignore local storage error */
        }
      }

      // ONLY start polling overlay when POST returns 200 OK
      setIsSubmitting(false);
      setConnectProgress(5);
      setCurrentPhase('CONNECTING');
      setIsConnecting(true);
    } catch (err: any) {
      setIsSubmitting(false);
      setIsConnecting(false);
      /* Handled by global API error interceptor in apiClient */
    }
  };

  const handleSkipWifi = async () => {
    setIsSubmitting(true);

    try {
      const res = await api.skipWifiSetup({ adminPin, shopName });

      if (res?.handoffToken) {
        try {
          localStorage.setItem('onboarding_handoff_token', res.handoffToken);
        } catch {
          /* ignore local storage error */
        }
      }

      // ONLY start polling overlay when POST returns 200 OK
      setIsSubmitting(false);
      setSelectedSsid('CURRENT_ACTIVE_NETWORK');
      setConnectProgress(15);
      setCurrentPhase('VERIFYING_INTERNET');
      setIsConnecting(true);
    } catch (err: any) {
      setIsSubmitting(false);
      setIsConnecting(false);
      /* Handled by global API error interceptor in apiClient */
    }
  };

  // Resilient Multi-Phase Provisioning Polling Engine
  useEffect(() => {
    if (!isConnecting) return;

    let isMounted = true;
    let secondsElapsed = 0;
    let consecutiveIdleCount = 0;
    let consecutiveNetworkErrors = 0;
    const MAX_POLLING_DURATION = 90; // 90 seconds overall window

    let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (!isMounted) return;
      secondsElapsed += 2;

      // Smooth progress interpolation
      const calculatedProgress = Math.min(95, Math.round((secondsElapsed / MAX_POLLING_DURATION) * 100));
      setConnectProgress(calculatedProgress);

      let nextInterval = 2000;

      try {
        const res = await api.getProvisionStatus();
        consecutiveNetworkErrors = 0; // reset on successful poll

        if (res?.status === 'idle') {
          consecutiveIdleCount += 1;
          // If server reports idle repeatedly, the provisioning process is not running
          if (consecutiveIdleCount >= 3) {
            setIsConnecting(false);
            return;
          }
          setCurrentPhase('CONNECTING');
        } else {
          consecutiveIdleCount = 0;

          if (res?.status === 'success') {
            setConnectProgress(100);
            setIsConnecting(false);
            onCompleteRef.current();
            return;
          }

          if (res?.status === 'failed') {
            setIsConnecting(false);
            return;
          }

          if (res?.status === 'verifying_internet') {
            setCurrentPhase('VERIFYING_INTERNET');
          } else if (res?.status === 'starting_tunnel' || res?.status === 'verifying_tunnel') {
            setCurrentPhase('STARTING_TUNNEL');
          } else {
            setCurrentPhase('CONNECTING');
          }
        }
      } catch (err) {
        // Network drop during Wi-Fi switch is expected behavior
        consecutiveNetworkErrors += 1;
        setCurrentPhase('TRANSITION');

        // Adaptive exponential backoff schedule: 2s, 4s, 6s, 8s, max 10s
        nextInterval = Math.min(10000, 2000 + consecutiveNetworkErrors * 2000);

        if (secondsElapsed >= MAX_POLLING_DURATION) {
          setIsConnecting(false);
          return;
        }
      }

      if (isMounted) {
        pollTimeoutId = setTimeout(poll, nextInterval);
      }
    };

    pollTimeoutId = setTimeout(poll, 1500);

    return () => {
      isMounted = false;
      if (pollTimeoutId) clearTimeout(pollTimeoutId);
    };
  }, [isConnecting]);

  const renderSignalGauge = (signal: number) => {
    const blocks = Math.min(4, Math.max(1, Math.ceil(signal / 25)));
    const filled = '█ '.repeat(blocks);
    const empty = '░ '.repeat(4 - blocks);
    return `[ ${filled}${empty}] ${signal}%`;
  };

  const renderProgressBlocks = (progress: number) => {
    const filled = Math.min(10, Math.max(0, Math.round((progress / 100) * 10)));
    const empty = 10 - filled;
    return `[ ${'█ '.repeat(filled)}${'░ '.repeat(empty)}]`;
  };

  const activeNetworks = networks.filter(n => n.isActive);
  const availableNetworks = networks.filter(n => !n.isActive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
          onClick={fetchNetworks}
          disabled={isScanning}
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
            availableNetworks.map(net => (
              <div
                key={net.ssid}
                className="wifi-network-item-row"
                onClick={() => handleNetworkSelect(net)}
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
            disabled={isSubmitting || isConnecting}
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

      {/* Fullscreen Phased Provisioning Hazard Overlay */}
      {isConnecting && (
        <div className="hazard-overlay-backdrop">
          <div className="hazard-overlay-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span className={`led-diode ${currentPhase === 'TRANSITION' ? 'amber' : currentPhase === 'STARTING_TUNNEL' ? 'green' : 'amber'}`} style={{ width: '16px', height: '16px' }} />
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {currentPhase === 'CONNECTING' && '[ APPLYING_NETWORK_CREDENTIALS ]'}
                {currentPhase === 'VERIFYING_INTERNET' && '[ VERIFYING_WAN_CONNECTIVITY ]'}
                {currentPhase === 'STARTING_TUNNEL' && '[ ESTABLISHING_REMOTE_TUNNEL ]'}
                {currentPhase === 'TRANSITION' && '[ NETWORK_TRANSITION_IN_PROGRESS ]'}
              </h3>
            </div>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {currentPhase === 'CONNECTING' && `The kiosk terminal is cycling its wireless radio to join [${selectedSsid}]. Please wait while authentication completes.`}
              {currentPhase === 'VERIFYING_INTERNET' && `Wi-Fi association confirmed. Validating DNS resolution and secure gateway communication.`}
              {currentPhase === 'STARTING_TUNNEL' && `Provisioning encrypted Cloudflare Quick Tunnel for customer and remote dashboard access.`}
              {currentPhase === 'TRANSITION' && `The terminal is switching network interfaces. If disconnected from the temporary hotspot, reconnect to your local Wi-Fi. Please keep this screen open.`}
            </p>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '8px', letterSpacing: '0.05em' }}>
              {renderProgressBlocks(connectProgress)} {connectProgress}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

