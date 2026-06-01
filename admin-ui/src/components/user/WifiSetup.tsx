import React, { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, AlertCircle, RefreshCw, Wifi, ArrowRight } from 'lucide-react';
import { Button } from '../shared/Button';
import { ValidatedInput } from '../shared/ValidatedInput';
import { useModal } from '../../context/ModalContext';
import { api } from '../../services/api';
import type { WifiNetwork } from '../../types';

interface WifiConnectModalBodyProps {
  ssid: string;
  isSaved?: boolean;
  closeModal: () => void;
  onConnectStart: () => void;
}

const WifiConnectModalBody = ({ ssid, isSaved, closeModal, onConnectStart }: WifiConnectModalBodyProps) => {
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {!isSaved && (
        <ValidatedInput
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Leave blank if open"
        />
      )}
      {isSaved && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
          This network is already saved. You can connect without entering a password.
        </p>
      )}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
        <Button type="button" variant="ghost" onClick={closeModal} disabled={isConnecting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isConnecting}>
          {isConnecting ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Loader2 className="animate-spin" size={16} />
              <span>Connecting...</span>
            </span>
          ) : isSaved ? (
            'Connect'
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
    if (net.isActive) return;
    openModal({
      title: `Connect to ${net.ssid}`,
      content: (
        <WifiConnectModalBody
          ssid={net.ssid}
          isSaved={net.isSaved}
          closeModal={closeModal}
          onConnectStart={() => {
            setStatus('connecting');
            closeModal();
          }}
        />
      )
    });
  };

  if (status === 'connecting') {
    return (
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', border: '2px solid var(--border-default)', borderRadius: '2px' }}>
          <div style={{ color: 'var(--status-idle)' }}>
            <ShieldCheck size={48} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Applying Credentials</h2>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            The Spooler will now reboot its network. Please close this window and reconnect your device to your main Wi-Fi.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem', color: 'var(--accent-primary)' }}>
            <Loader2 className="animate-spin" size={32} />
          </div>
        </div>
      </div>
    );
  }

  const activeNetworks = networks.filter(n => n.isActive);
  const availableNetworks = networks.filter(n => !n.isActive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
      {/* Title Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Wi-Fi Connection Setup</h2>
          <p className="page-desc" style={{ margin: '0.25rem 0 0 0' }}>Provision the Spooler by linking it to a local hotspot</p>
        </div>
        <Button 
          variant="mechanical" 
          onClick={fetchNetworks}
          disabled={isScanning}
          rightIcon={<RefreshCw className={isScanning ? 'animate-spin' : ''} size={18} />}
        >
          Refresh List
        </Button>
      </div>

      {/* Status / Error */}
      {status === 'error' && (
        <div 
          style={{ 
            background: 'rgba(255, 68, 68, 0.08)', 
            border: '1px solid var(--border-default)', 
            borderLeft: '4px solid var(--status-error)', 
            borderRadius: '2px', 
            padding: '1rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem' 
          }}
        >
          <AlertCircle size={20} style={{ color: 'var(--status-error)', flexShrink: 0 }} />
          <p style={{ color: 'var(--status-error)', margin: 0, fontSize: '0.9rem' }}>{errorMsg}</p>
        </div>
      )}

      {/* Connected Network */}
      {status === 'ready' && activeNetworks.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600 }}>Currently Connected</h3>
          <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '2px solid var(--status-idle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(56, 189, 113, 0.15)', padding: '0.6rem', borderRadius: '50%' }}>
                <ShieldCheck size={28} style={{ color: 'var(--status-idle)' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="data-mono" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{activeNetworks[0].ssid}</span>
                  <span className="badge" style={{ background: 'var(--status-idle)', color: '#fff', fontSize: '0.7rem', padding: '0.2rem 0.5rem', textTransform: 'none' }}>Active Connection</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Wifi size={14} />
                  <span>Signal Strength: {activeNetworks[0].signal}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Network List Card */}
      <div>
        <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600 }}>Available Networks</h3>
        <div className="card" style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column' }}>
        {status === 'scanning' && networks.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Loader2 className="animate-spin" size={36} style={{ color: 'var(--accent-primary)' }} />
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>Searching for local networks...</p>
          </div>
        ) : availableNetworks.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            No additional networks found.
          </div>
        ) : (
          availableNetworks.map((net) => (
            <div 
              key={net.ssid} 
              className="wifi-network-item-row"
              onClick={() => handleNetworkClick(net)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Wifi size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <span className="data-mono" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{net.ssid}</span>
                <span className="badge badge-default" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', textTransform: 'none' }}>{net.signal}%</span>
              </div>
              <ArrowRight size={18} className="wifi-arrow-icon" />
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
