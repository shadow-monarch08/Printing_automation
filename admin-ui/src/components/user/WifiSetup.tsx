import React, { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { Button } from '../shared/Button';
import { useModal } from '../../context/ModalContext';
import { api } from '../../services/api';
import type { WifiNetwork } from '../../types';

const getSignalIcon = (signal: number) => {
  const bars = signal > 75 ? 4 : signal > 50 ? 3 : signal > 25 ? 2 : 1;
  return (
    <svg className="wifi-signal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.42 9a16 16 0 0 1 21.16 0" strokeOpacity={bars >= 4 ? 1 : 0.2} />
      <path d="M5 12.55a11 11 0 0 1 14.08 0" strokeOpacity={bars >= 3 ? 1 : 0.2} />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" strokeOpacity={bars >= 2 ? 1 : 0.2} />
      <line x1="12" y1="20" x2="12.01" y2="20" strokeOpacity={bars >= 1 ? 1 : 0.2} />
    </svg>
  );
};

interface WifiConnectModalBodyProps {
  ssid: string;
  closeModal: () => void;
  onConnectStart: () => void;
}

const WifiConnectModalBody = ({ ssid, closeModal, onConnectStart }: WifiConnectModalBodyProps) => {
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    onConnectStart();
    try {
      await api.connectToWifi(ssid, password);
      // Connection drops, swallow error as Captive Portal reboots network
    } catch (err) {
      console.warn('Network connection dropped as expected:', err);
    } finally {
      closeModal();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="wifi-network-form">
      <div className="wifi-form-group">
        <label className="wifi-form-label">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave blank if open"
          className="wifi-form-input"
          autoFocus
        />
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
        <Button type="button" variant="ghost" onClick={closeModal} disabled={isConnecting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isConnecting}>
          {isConnecting ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Loader2 className="animate-spin" size={16} />
              <span>Connecting...</span>
            </span>
          ) : (
            'Join Network'
          )}
        </Button>
      </div>
    </form>
  );
};

export function WifiSetup() {
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedSsid, setSelectedSsid] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [status, setStatus] = useState<'scanning' | 'ready' | 'connecting' | 'error'>('scanning');

  const { openModal, closeModal } = useModal();

  const fetchNetworks = async () => {
    setIsScanning(true);
    if (status !== 'ready') setStatus('scanning');
    
    try {
      const data = await api.scanWifiNetworks();
      setNetworks(data);
      setStatus('ready');
      setErrorMsg('');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'Could not scan for Wi-Fi networks. Please refresh or try again.');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    fetchNetworks();
  }, []);

  const handleNetworkClick = (net: WifiNetwork) => {
    setSelectedSsid(net.ssid);
    openModal({
      title: `Connect to ${net.ssid}`,
      content: (
        <WifiConnectModalBody
          ssid={net.ssid}
          closeModal={closeModal}
          onConnectStart={() => {
            setIsConnecting(true);
            setStatus('connecting');
            closeModal();
          }}
        />
      )
    });
  };

  if (status === 'connecting') {
    return (
      <div className="wifi-connecting-container">
        <div className="wifi-connecting-card">
          <div className="wifi-connecting-icon-wrap">
            <ShieldCheck size={48} />
          </div>
          <h2>Applying Credentials</h2>
          <p>
            The Spooler will now reboot its network. Please close this window and reconnect your phone to your main Wi-Fi.
          </p>
          <div className="wifi-connecting-loader-wrap">
            <Loader2 className="animate-spin" size={32} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wifi-setup-container">
      <div className="wifi-setup-content">
        {/* Header */}
        <div className="wifi-setup-header-card">
          <div className="wifi-setup-header-text">
            <h1>Wi-Fi Setup</h1>
            <p>Connect to your local network</p>
          </div>
          <button 
            onClick={fetchNetworks}
            disabled={isScanning}
            className="wifi-setup-refresh-btn"
            aria-label="Refresh List"
          >
            <RefreshCw className={isScanning ? 'animate-spin' : ''} size={20} />
          </button>
        </div>

        {/* Status / Error */}
        {status === 'error' && (
          <div className="wifi-setup-error-card">
            <AlertCircle size={20} className="wifi-setup-error-text" />
            <p className="wifi-setup-error-text">{errorMsg}</p>
          </div>
        )}

        {/* Network List */}
        <div className="wifi-network-list">
          {status === 'scanning' && networks.length === 0 ? (
            <div className="wifi-setup-loading-state">
              <Loader2 className="animate-spin" size={32} />
              <p className="wifi-setup-loading-text">Searching for networks...</p>
            </div>
          ) : networks.length === 0 ? (
            <div className="wifi-setup-empty-state">
              <p className="wifi-setup-empty-text">No networks found.</p>
            </div>
          ) : (
            networks.map((net) => (
              <div key={net.ssid} className="wifi-network-item">
                <button
                  onClick={() => handleNetworkClick(net)}
                  className="wifi-network-trigger"
                >
                  <div className="wifi-network-info">
                    {getSignalIcon(net.signal)}
                    <span className="wifi-network-ssid">{net.ssid}</span>
                  </div>
                  <ChevronDown className={`wifi-network-chevron ${selectedSsid === net.ssid ? 'open' : ''}`} size={20} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
