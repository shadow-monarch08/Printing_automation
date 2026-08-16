import { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, RefreshCw, Globe, ExternalLink, Radio, Signal } from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { PaperTable } from '../../components/shared/PaperTable';
import { LoadingNet } from '../../components/shared/LoadingNet';
import { useModal } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { WifiConnectModalBody } from '../../components/onboarding/WifiConnectModalBody';
import { api } from '../../services/api';
import type { WifiNetwork, NetworkStatus } from '../../types';

export function Network() {
  const { openModal, closeModal } = useModal();
  const { addToast } = useToast();

  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedSsid, setSelectedSsid] = useState('');
  const [connectProgress, setConnectProgress] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.getNetworkStatus();
      setNetworkStatus(res);
    } catch (err) {
      console.warn('Failed to load network telemetry status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  const fetchNetworks = useCallback(async () => {
    setIsScanning(true);
    try {
      const data = await api.scanWifiNetworks();
      setNetworks(data);
    } catch (err: any) {
      addToast({
        title: 'Scan Throttled',
        description: 'Wi-Fi radio is currently busy or re-scanning.',
        type: 'warning',
      });
    } finally {
      setIsScanning(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchStatus();
    fetchNetworks();

    // Periodic telemetry polling
    const interval = setInterval(() => {
      fetchStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchNetworks]);

  const handleNetworkSelect = (network: WifiNetwork) => {
    setSelectedSsid(network.ssid);
    openModal({
      title: `RECONFIGURE_LINK: [${network.ssid}]`,
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
    try {
      await api.connectToWifi({
        ssid,
        password,
        profileName,
        isSaved,
      });

      // ONLY start polling on successful dispatch
      setConnectProgress(5);
      setIsConnecting(true);
    } catch (err: any) {
      setIsConnecting(false);
      /* Handled by global interceptor in apiClient */
    }
  };

  // Connection Progress Polling
  const pollRef = useRef(isConnecting);
  pollRef.current = isConnecting;

  useEffect(() => {
    if (!isConnecting) return;

    let seconds = 0;
    const interval = setInterval(async () => {
      seconds += 2;
      setConnectProgress(Math.min(95, Math.round((seconds / 40) * 100)));

      try {
        const res = await api.getWifiConnectionStatus();
        if (res?.status === 'success') {
          clearInterval(interval);
          setIsConnecting(false);
          setConnectProgress(100);
          addToast({
            title: 'Wi-Fi Connected',
            description: `Successfully authenticated and linked to "${selectedSsid}".`,
            type: 'success',
          });
          fetchStatus();
          fetchNetworks();
        } else if (res?.status === 'failed') {
          clearInterval(interval);
          setIsConnecting(false);
          // Handled automatically by pollingApiClient domain error interceptor
          fetchStatus();
        }
      } catch {
        if (seconds >= 45) {
          clearInterval(interval);
          setIsConnecting(false);
          fetchStatus();
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isConnecting, selectedSsid, addToast, fetchStatus, fetchNetworks]);

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

  if (isLoadingStatus && !networkStatus) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <LoadingNet message="Querying NetworkManager & Gateway Telemetry..." />
      </div>
    );
  }

  const activeNetworks = networks.filter((n) => n.isActive);
  const availableNetworks = networks.filter((n) => !n.isActive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            NETWORK & WIRELESS GATEWAY
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Inspect real-time telemetry, configure Wi-Fi adapters, and monitor emergency recovery daemon state.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            variant="mechanical"
            onClick={() => {
              fetchStatus();
              fetchNetworks();
            }}
            disabled={isScanning}
            style={{ height: '40px', padding: '0 16px' }}
          >
            <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
            <span>[ REFRESH TELEMETRY ]</span>
          </Button>
        </div>
      </div>

      {/* Telemetry Status Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Card 1: Internet / WAN Status */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} color="var(--accent-secondary)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                WAN_INTERNET_GATEWAY
              </span>
            </div>
            <span className={`led-diode ${networkStatus?.internetOnline ? 'green' : 'red'}`} />
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: networkStatus?.internetOnline ? 'var(--status-idle)' : 'var(--status-error)' }}>
            {networkStatus?.internetOnline ? '[ ONLINE // VERIFIED ]' : '[ OFFLINE // UNREACHABLE ]'}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {networkStatus?.internetOnline
              ? 'DNS resolution and external HTTPS gateways responding normally.'
              : 'External gateway unreachable. System remains fully operable via local Wi-Fi / hotspot.'}
          </div>
        </div>

        {/* Card 2: Active Wireless Profile */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wifi size={18} color="var(--accent-primary)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                WLAN0_ACTIVE_LINK
              </span>
            </div>
            <span className={`led-diode ${networkStatus?.activeProfile ? 'green' : 'amber'}`} />
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {networkStatus?.activeProfile ? `[ ${networkStatus.activeProfile} ]` : '[ NO_ACTIVE_LINK ]'}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {activeNetworks.length > 0
              ? `Associated signal strength: ${activeNetworks[0].signal}%`
              : 'Wi-Fi interface currently unassociated.'}
          </div>
        </div>

        {/* Card 3: Recovery Hotspot Daemon */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={18} color={networkStatus?.hotspotActive ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                EMERGENCY_RECOVERY_DAEMON
              </span>
            </div>
            <span className={`led-diode ${networkStatus?.hotspotActive ? 'amber' : 'green'}`} />
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: networkStatus?.hotspotActive ? 'var(--accent-primary)' : 'var(--status-idle)' }}>
            {networkStatus?.hotspotActive ? '[ HOTSPOT_ACTIVE ]' : `[ ${networkStatus?.recoveryState || 'ONLINE'} ]`}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {networkStatus?.hotspotActive
              ? 'Emergency access point [Kiosk-Hotspot] is broadcasting for local admin repair.'
              : 'Daemon standing by. Hotspot remains dormant during normal operation.'}
          </div>
        </div>
      </div>

      {/* Network Endpoints Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Remote Access Endpoint */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={16} color="var(--accent-secondary)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                [1] CLOUDFLARE_REMOTE_TUNNEL
              </span>
            </div>
            <span className={`led-diode ${networkStatus?.cloudflareUrl ? 'green' : 'red'}`} />
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              background: 'var(--bg-primary)',
              border: '1px dashed var(--border-default)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-primary)',
              wordBreak: 'break-all',
              marginBottom: '12px',
            }}
          >
            {networkStatus?.cloudflareUrl || 'TUNNEL_NOT_PROVISIONED'}
          </div>

          {networkStatus?.cloudflareUrl && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="ghost"
                onClick={() => window.open(networkStatus.cloudflareUrl!, '_blank')}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', height: '34px' }}
              >
                <ExternalLink size={13} style={{ marginRight: '6px' }} />
                <span>[ LAUNCH REMOTE ACCESS ]</span>
              </Button>
            </div>
          )}
        </div>

        {/* Local Access Endpoint */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wifi size={16} color="var(--text-secondary)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                [2] LOCAL_NETWORK_GATEWAY
              </span>
            </div>
            <span className={`led-diode ${networkStatus?.localAccessUrl ? 'green' : 'amber'}`} />
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              background: 'var(--bg-primary)',
              border: '1px dashed var(--border-default)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
              marginBottom: '12px',
            }}
          >
            {networkStatus?.localAccessUrl || 'NO_LOCAL_IP_ASSIGNED'}
          </div>

          {networkStatus?.localAccessUrl && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="ghost"
                onClick={() => window.open(networkStatus.localAccessUrl!, '_blank')}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', height: '34px' }}
              >
                <ExternalLink size={13} style={{ marginRight: '6px' }} />
                <span>[ LAUNCH LOCAL GATEWAY ]</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Available Access Points Matrix */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            AVAILABLE_WIRELESS_ACCESS_POINTS
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            DETECTED: {networks.length} NETWORKS
          </div>
        </div>

        <PaperTable style={{ margin: 0, padding: 0 }}>
          {isScanning && networks.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              SWEEPING WIRELESS FREQUENCIES...
            </div>
          ) : availableNetworks.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              NO ADDITIONAL WIRELESS ACCESS POINTS DETECTED.
            </div>
          ) : (
            availableNetworks.map((net) => (
              <div
                key={net.ssid}
                className="wifi-network-item-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border-default)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onClick={() => handleNetworkSelect(net)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Signal size={16} color="var(--accent-primary)" />
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
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', height: '30px', padding: '0 12px' }}
                  >
                    [ RECONFIGURE ➔ ]
                  </Button>
                </div>
              </div>
            ))
          )}
        </PaperTable>
      </div>

      {/* Connecting Hazard Overlay */}
      {isConnecting && (
        <div className="hazard-overlay-backdrop">
          <div className="hazard-overlay-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span className="led-diode amber" style={{ width: '16px', height: '16px' }} />
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                [ RECONFIGURING_WIRELESS_INTERFACE ]
              </h3>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Connecting to wireless access point <strong>{selectedSsid}</strong>. The recovery daemon has been paused to prevent interface contention.
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
