import React, { useState, useEffect } from 'react';
import { Wifi, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

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

  const handleSubmit = async (e: React.FormEvent) => {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center border-t-4 border-indigo-500">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full mb-6">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Applying Credentials</h2>
          <p className="text-gray-600 leading-relaxed">
            The Spooler will now reboot its network. Please close this window and reconnect your phone to your main Wi-Fi.
          </p>
          <div className="mt-8 flex justify-center">
            <Loader2 className="animate-spin text-indigo-500" size={24} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4">
      <div className="max-w-md w-full mx-auto mt-12">
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          <div className="bg-indigo-600 p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Wifi size={24} />
              <h1 className="text-xl font-bold">Network Setup</h1>
            </div>
            <p className="text-indigo-100 text-sm">
              Connect the Smart Spooler to your local Wi-Fi network.
            </p>
          </div>

          <div className="p-6">
            {status === 'scanning' ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
                <p className="text-gray-500 font-medium">Scanning for networks...</p>
              </div>
            ) : status === 'error' ? (
              <div className="py-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 text-red-600 rounded-full mb-4">
                  <AlertCircle size={24} />
                </div>
                <p className="text-gray-800 mb-6">{errorMsg}</p>
                <button 
                  onClick={fetchNetworks}
                  className="w-full bg-gray-100 text-gray-700 font-bold py-3 px-4 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Retry Scan
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Select Network
                  </label>
                  <select 
                    value={selectedSsid}
                    onChange={(e) => setSelectedSsid(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-md py-3 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Wi-Fi Password
                    </label>
                    <input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter network password"
                      className="w-full bg-white border border-gray-300 rounded-md py-3 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <p className="mt-2 text-xs text-gray-500 italic">
                      Leave blank if the network is open.
                    </p>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={!selectedSsid}
                  className={`w-full font-bold py-4 px-4 rounded-md transition-all ${
                    selectedSsid 
                      ? 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:transform active:scale-[0.98]' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Connect Spooler
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-gray-400 text-xs">
          <p>© 2024 Smart Spooler Appliance • Version 2.1</p>
        </div>
      </div>
    </div>
  );
}
