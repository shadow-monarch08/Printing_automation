import React, { useState, useEffect } from 'react';
import { Wifi, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '../shared/Button';
import '../../styles/wifi-setup.css';

interface Network {
  ssid: string;
  signal: number;
}

export function WifiSetup() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedSsid, setSelectedSsid] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'scanning' | 'ready' | 'connecting' | 'error'>('scanning');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchNetworks = async () => {
    setStatus('scanning');
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/wifi/scan`);
      if (!response.ok) throw new Error('Failed to scan networks');
      const data = await response.json();
      setNetworks(data);
      setStatus('ready');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg('Could not scan for Wi-Fi networks. Please refresh or try again.');
    }
  };

  useEffect(() => {
    fetchNetworks();
  }, []);

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!selectedSsid) return;

    setStatus('connecting');
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      await fetch(`${baseUrl}/wifi/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid: selectedSsid, password }),
      });
      // We don't check for response.ok here because the connection WILL drop
    } catch (err) {
      // Swallowing errors as per instructions since the network will drop
      console.warn('Network connection dropped as expected:', err);
    }
  };

  if (status === 'connecting') {
    return (
      <div className="wifi-setup-container">
        <div className="wifi-connecting-card">
          <div className="wifi-connecting-icon">
            <ShieldCheck size={32} />
          </div>
          <h2>Applying Credentials</h2>
          <p>
            The Spooler will now reboot its network. Please close this window and reconnect your phone to your main Wi-Fi.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wifi-setup-container">
      <div className="wifi-setup-content">
        <div className="wifi-setup-card">
          <div className="wifi-setup-header">
            <div className="wifi-setup-header-title">
              <Wifi size={24} />
              <h1>Network Setup</h1>
            </div>
            <p>
              Connect the Smart Spooler to your local Wi-Fi network.
            </p>
          </div>

          <div className="wifi-setup-body">
            {status === 'scanning' ? (
              <div className="wifi-setup-scanning">
                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} />
                <p>Scanning for networks...</p>
              </div>
            ) : status === 'error' ? (
              <div className="wifi-setup-error">
                <div className="wifi-setup-error-icon">
                  <AlertCircle size={24} />
                </div>
                <p>{errorMsg}</p>
                <Button 
                  onClick={fetchNetworks}
                  variant="mechanical"
                  style={{ width: '100%' }}
                >
                  Retry Scan
                </Button>
              </div>
            ) : (
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="wifi-form-group">
                  <label className="wifi-form-label">
                    Select Network
                  </label>
                  <select 
                    value={selectedSsid}
                    onChange={(e) => setSelectedSsid(e.target.value)}
                    className="select-field"
                  >
                    <option value="" disabled>Choose a Wi-Fi network...</option>
                    {networks.map((net) => (
                      <option key={net.ssid} value={net.ssid}>
                        {net.ssid} ({net.signal}%)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSsid && (
                  <div className="wifi-form-group" style={{ animation: 'slideDown 0.3s ease-out' }}>
                    <label className="wifi-form-label">
                      Wi-Fi Password
                    </label>
                    <input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter network password"
                      className="input-field"
                    />
                    <p className="wifi-form-hint">
                      Leave blank if the network is open.
                    </p>
                  </div>
                )}

                <Button 
                  variant="mechanical"
                  disabled={!selectedSsid}
                  className="wifi-btn-submit"
                  onClick={handleSubmit}
                  style={{ width: '100%' }}
                >
                  Connect Spooler
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="wifi-setup-footer">
          <p>© 2024 Smart Spooler Appliance • Version 2.1</p>
        </div>
      </div>
    </div>
  );
}
