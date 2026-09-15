import { useState, useEffect } from 'react';
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

export function Step2WifiSetup({ shopName, adminPin }: Step2WifiSetupProps) {
  const provisioningState = useAdminStore((s) => s.provisioningState);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDispatched, setIsDispatched] = useState(false);
  const [selectedSsid, setSelectedSsid] = useState('');

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
      await api.provisionSetup({
        wifiSsid: ssid,
        wifiPassword: password,
        profileName,
        isSaved,
        adminPin,
        shopName,
      });

      setIsSubmitting(false);
      setIsDispatched(true);
    } catch (err: any) {
      setIsSubmitting(false);
      setIsDispatched(false);
    }
  };

  const handleSkipWifi = async () => {
    setIsSubmitting(true);

    try {
      await api.skipWifiSetup({ adminPin, shopName });
      setIsSubmitting(false);
      setSelectedSsid('CURRENT_ACTIVE_NETWORK');
      setIsDispatched(true);
    } catch (err: any) {
      setIsSubmitting(false);
      setIsDispatched(false);
    }
  };

  const renderSignalGauge = (signal: number) => {
    const blocks = Math.min(4, Math.max(1, Math.ceil(signal / 25)));
    const filled = '█ '.repeat(blocks);
    const empty = '░ '.repeat(4 - blocks);
    return `[ ${filled}${empty}] ${signal}%`;
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
            disabled={isSubmitting || isDispatched}
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

      {/* Dispatched Confirmation Modal Card */}
      {isDispatched && (
        <div className="hazard-overlay-backdrop">
          <div className="hazard-overlay-card" style={{ maxWidth: '500px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <span className="led-diode green" style={{ width: '14px', height: '14px' }} />
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                [ CONFIGURATION_DISPATCHED ]
              </h3>
            </div>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.6 }}>
              The kiosk terminal has received your shop identity and network credentials for <strong>[{selectedSsid || 'TARGET_NETWORK'}]</strong>.
            </p>

            <div
              style={{
                background: 'var(--bg-primary)',
                border: '2px solid var(--status-idle)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--status-idle)', marginBottom: '6px' }}>
                👉 WATCH THE 5-INCH TERMINAL DISPLAY
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                Real-time 4-phase telemetry is streaming directly on the kiosk chassis screen. Once complete, your live shop QR code will be displayed for you and your customers to scan.
              </div>
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
              You may now disconnect from the setup hotspot or close this window.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
