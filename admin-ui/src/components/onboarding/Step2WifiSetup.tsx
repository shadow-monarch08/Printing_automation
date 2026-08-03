import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../shared/Button';
import { PaperTable } from '../shared/PaperTable';
import { useModal } from '../../context/ModalContext';
import { WifiConnectModalBody } from './WifiConnectModalBody';
import { api } from '../../services/api';
import type { WifiNetwork } from '../../types';

interface Step2WifiSetupProps {
  shopName: string;
  adminPin: string;
  onComplete: () => void;
}

export function Step2WifiSetup({ shopName, adminPin, onComplete }: Step2WifiSetupProps) {
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedSsid, setSelectedSsid] = useState('');
  const [connectProgress, setConnectProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const { openModal, closeModal } = useModal();

  const fetchNetworks = async () => {
    setIsScanning(true);
    try {
      const data = await api.scanWifiNetworks();
      setNetworks(data);
      setErrorMsg('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Could not scan Wi-Fi networks.');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    fetchNetworks();
  }, []);

  const handleNetworkSelect = (net: WifiNetwork) => {
    openModal({
      title: `CONNECT_TO: [${net.ssid}]`,
      content: (
        <WifiConnectModalBody
          ssid={net.ssid}
          isSaved={net.isSaved}
          closeModal={closeModal}
          onSubmit={(password) => handleConnectSubmit(net.ssid, password)}
        />
      ),
    });
  };

  const handleConnectSubmit = async (ssid: string, password?: string) => {
    setSelectedSsid(ssid);
    setIsConnecting(true);
    setConnectProgress(0);
    setErrorMsg('');

    /* PRODUCTION CALL COMMENTED OUT FOR DUMMY PREVIEW MODE:
    try {
      await api.provisionSetup({
        adminPin,
        shopName,
        wifiSsid: ssid,
        wifiPassword: password,
      });
    } catch (err) {
      console.warn('Network provision call submitted:', err);
    }
    */
    console.log('[Dummy Onboarding Preview] Wi-Fi selected:', { ssid, password, shopName, adminPin });
  };

  const handleSkipWifi = async () => {
    try {
      await api.skipWifiSetup({ adminPin, shopName });
    } catch (err) {
      console.warn('Skip Wi-Fi setup call:', err);
    }
    onComplete();
  };

  // Dummy Preview Mode: Simulated 3-second progress timer to demonstrate hazard overlay and advance to Step 3
  useEffect(() => {
    if (!isConnecting) return;

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setConnectProgress(Math.min(100, step * 33));

      if (step >= 3) {
        clearInterval(interval);
        setIsConnecting(false);
        onComplete();
      }
    }, 1000);

    /* PRODUCTION POLLING ENGINE COMMENTED OUT FOR DUMMY PREVIEW MODE:
    let failedPollCount = 0;
    let secondsElapsed = 0;

    const interval = setInterval(async () => {
      secondsElapsed += 2;
      setConnectProgress(Math.min(100, Math.round((secondsElapsed / 36) * 100)));

      try {
        const res = await api.getWifiConnectionStatus();
        if (res?.status === 'failed') {
          clearInterval(interval);
          setIsConnecting(false);
          setErrorMsg(res.error || 'Wi-Fi Authentication Failed.');
          return;
        }

        if (res?.status === 'success') {
          clearInterval(interval);
          setIsConnecting(false);
          onComplete();
          return;
        }
      } catch (err) {
        failedPollCount += 1;
        if (failedPollCount >= 18 || secondsElapsed >= 36) {
          clearInterval(interval);
          setIsConnecting(false);
          onComplete();
        }
      }
    }, 2000);
    */

    return () => clearInterval(interval);
  }, [isConnecting, onComplete]);

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
          <span>[ REFRESH SCAN</span>
          <RefreshCw className={isScanning ? 'animate-spin' : ''} size={14} style={{ marginLeft: '6px' }} />
          <span>]</span>
        </Button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div
          style={{
            background: 'rgba(255, 68, 68, 0.08)',
            border: '1px solid var(--border-default)',
            borderLeft: '4px solid var(--status-error)',
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--status-error)',
          }}
        >
          [ERROR] {errorMsg}
        </div>
      )}

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

        {/* Skip Wi-Fi Setup Option */}
        <Button
          variant="ghost"
          onClick={handleSkipWifi}
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
          [ PROCEED WITH CURRENT ACTIVE NETWORK (SKIP WI-FI SETUP) ➔ ]
        </Button>
      </div>

      {/* Fullscreen Connecting Hazard Overlay */}
      {isConnecting && (
        <div className="hazard-overlay-backdrop">
          <div className="hazard-overlay-card">
            <span className="led-diode amber" style={{ width: '16px', height: '16px' }} />
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              [ APPLYING_NETWORK_CREDENTIALS ]
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              The kiosk terminal is cycling its Wi-Fi radio to join <strong>{selectedSsid}</strong>. Please wait while authentication completes.
            </p>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '8px', letterSpacing: '0.05em' }}>
              {renderProgressBlocks(connectProgress)} {connectProgress}% (36s TIMEOUT)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
