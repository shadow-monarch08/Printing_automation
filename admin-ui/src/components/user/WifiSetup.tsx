import React, { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { Button } from '../shared/Button';

interface Network {
  ssid: string;
  signal: number;
}

const getSignalIcon = (signal: number) => {
  const bars = signal > 75 ? 4 : signal > 50 ? 3 : signal > 25 ? 2 : 1;
  return (
    <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.42 9a16 16 0 0 1 21.16 0" strokeOpacity={bars >= 4 ? 1 : 0.2} />
      <path d="M5 12.55a11 11 0 0 1 14.08 0" strokeOpacity={bars >= 3 ? 1 : 0.2} />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" strokeOpacity={bars >= 2 ? 1 : 0.2} />
      <line x1="12" y1="20" x2="12.01" y2="20" strokeOpacity={bars >= 1 ? 1 : 0.2} />
    </svg>
  );
};

export function WifiSetup() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedSsid, setSelectedSsid] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [status, setStatus] = useState<'scanning' | 'ready' | 'connecting' | 'error'>('scanning');

  const fetchNetworks = async () => {
    setIsScanning(true);
    if (status !== 'ready') setStatus('scanning');
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/wifi/scan`);
      if (!response.ok) throw new Error('Failed to scan networks');
      const data = await response.json();
      setNetworks(data);
      setStatus('ready');
      setErrorMsg('');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg('Could not scan for Wi-Fi networks. Please refresh or try again.');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    fetchNetworks();
  }, []);

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!selectedSsid) return;

    setIsConnecting(true);
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-6">
          <div className="flex justify-center text-green-500">
            <ShieldCheck size={48} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Applying Credentials</h2>
          <p className="text-gray-600">
            The Spooler will now reboot its network. Please close this window and reconnect your phone to your main Wi-Fi.
          </p>
          <div className="flex justify-center pt-4">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center pt-8 px-4 pb-12 font-sans">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="bg-white rounded-t-xl rounded-b-md shadow p-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Wi-Fi Setup</h1>
            <p className="text-sm text-gray-500">Connect to your local network</p>
          </div>
          <button 
            onClick={fetchNetworks}
            disabled={isScanning}
            className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors ${isScanning ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label="Refresh List"
          >
            <RefreshCw className={`w-5 h-5 text-gray-700 ${isScanning ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Status / Error */}
        {status === 'error' && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Network List */}
        <div className="bg-white rounded-xl shadow overflow-hidden divide-y divide-gray-100">
          {status === 'scanning' && networks.length === 0 ? (
            <div className="p-8 text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
              <p className="text-gray-500 text-sm">Searching for networks...</p>
            </div>
          ) : networks.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No networks found.
            </div>
          ) : (
            networks.map((net) => (
              <div key={net.ssid} className="flex flex-col">
                <button
                  onClick={() => {
                    setSelectedSsid(selectedSsid === net.ssid ? null : net.ssid);
                    setPassword('');
                  }}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 focus:outline-none transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    {getSignalIcon(net.signal)}
                    <span className="font-medium text-gray-800">{net.ssid}</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${selectedSsid === net.ssid ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Accordion Content */}
                {selectedSsid === net.ssid && (
                  <div className="bg-gray-50 px-5 py-4 border-t border-gray-100 animate-in slide-in-from-top-2">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Leave blank if open"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isConnecting}
                        className="w-full flex justify-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        {isConnecting ? (
                          <span className="flex items-center space-x-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Connecting...</span>
                          </span>
                        ) : (
                          'Join Network'
                        )}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
