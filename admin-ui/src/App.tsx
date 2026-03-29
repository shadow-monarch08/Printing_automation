import { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Star,
  FileText,
  Loader2
} from 'lucide-react';

// Define the API base URL to use relative paths so it seamlessly proxies through Express
const API = '';

interface PrinterInfo {
  name: string;
  description: string;
  status: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

function App() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [defaultPrinter, setDefaultPrinter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Set Default Form
  const [selectedDefault, setSelectedDefault] = useState<string>('');
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  // Print Form
  const [selectedPrintPrinter, setSelectedPrintPrinter] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast System
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Fetch Data
  const loadPrinters = async () => {
    setLoading(true);
    try {
      const [printersRes, defaultRes] = await Promise.all([
        fetch(`${API}/printers`).then((r) => r.json()),
        fetch(`${API}/printers/default`).then((r) => r.json()),
      ]);

      setPrinters(printersRes.printers || []);
      const def = defaultRes.defaultPrinter || '';
      setDefaultPrinter(def);
      
      if (!selectedDefault) setSelectedDefault(def);
      
      addToast(`Loaded ${printersRes.printers?.length || 0} printers.`, 'success');
    } catch (e: any) {
      addToast(`Failed to load printers: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrinters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers
  const handleSetDefault = async () => {
    if (!selectedDefault) return addToast('Select a printer first', 'error');
    setIsSettingDefault(true);
    try {
      const res = await fetch(`${API}/printers/default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerName: selectedDefault }),
      }).then((r) => r.json());

      if (res.success) {
        addToast(res.message || 'Default printer updated', 'success');
        loadPrinters(); // Refresh list to update badge
      } else {
        addToast(res.message, 'error');
      }
    } catch (e: any) {
      addToast(`Error: ${e.message}`, 'error');
    } finally {
      setIsSettingDefault(false);
    }
  };

  const handlePrint = async () => {
    if (!file) return addToast('Choose a file to print first', 'error');
    setIsPrinting(true);

    const formData = new FormData();
    formData.append('file', file);
    if (selectedPrintPrinter) formData.append('printer', selectedPrintPrinter);

    try {
      const res = await fetch(`${API}/print`, {
        method: 'POST',
        body: formData,
      }).then((r) => r.json());

      if (res.success) {
        addToast(`Successfully printed "${res.file}"! Job ID: ${res.jobId}`, 'success');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        addToast(res.message || 'Failed to print', 'error');
      }
    } catch (e: any) {
      addToast(`Print failed: ${e.message}`, 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && <CheckCircle2 size={18} />}
            {t.type === 'error' && <AlertCircle size={18} />}
            {t.type === 'info' && <RefreshCw size={18} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      <header>
        <h1>Print Admin Portal</h1>
        <p className="subtitle">Secure Local Printing System Management</p>
      </header>

      {/* Printer List Card */}
      <section className="glass-card">
        <h2>
          <Printer size={20} className="text-indigo-400" />
          Available Printers
        </h2>
        
        {loading ? (
          <div className="empty-state">
            <Loader2 className="spinner" size={24} />
            <p>Scanning network for printers...</p>
          </div>
        ) : printers.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={32} opacity={0.5} />
            <p>No printers found on the network.</p>
          </div>
        ) : (
          <div className="printer-list">
            {printers.map((p) => (
              <div key={p.name} className="printer-item">
                <div className="printer-info">
                  <Printer size={16} opacity={0.7} />
                  <span className="printer-name">{p.name}</span>
                </div>
                <div className="badges">
                  <span className={`badge ${p.status === 'idle' ? 'idle' : 'busy'}`}>
                    {p.status}
                  </span>
                  {p.name === defaultPrinter && (
                    <span className="badge default">Default</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="secondary-btn" onClick={loadPrinters} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </section>

      {/* Set Default Printer Card */}
      <section className="glass-card">
        <h2>
          <Star size={20} className="text-purple-400" />
          Set Default Printer
        </h2>
        <div className="form-group">
          <label>Select a printer to be the system default</label>
          <div className="form-row">
            <select 
              value={selectedDefault} 
              onChange={(e) => setSelectedDefault(e.target.value)}
              disabled={printers.length === 0}
            >
              <option value="" disabled>Select a printer</option>
              {printers.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <button 
              onClick={handleSetDefault} 
              disabled={!selectedDefault || isSettingDefault || printers.length === 0}
            >
              {isSettingDefault ? <Loader2 className="spinner" size={16} /> : <Star size={16} />}
              Set Default
            </button>
          </div>
        </div>
      </section>

      {/* Upload & Print Card */}
      <section className="glass-card" style={{ paddingBottom: '2rem' }}>
        <h2>
          <Upload size={20} className="text-blue-400" />
          Upload & Print Document
        </h2>
        <div className="form-group">
          <label>Select document (PDF, TXT, etc.) max 50MB</label>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
          />
        </div>
        <div className="form-group">
          <label>Target Printer (Optional, uses default if empty)</label>
          <div className="form-row">
            <select 
              value={selectedPrintPrinter} 
              onChange={(e) => setSelectedPrintPrinter(e.target.value)}
            >
              <option value="">Use System Default ({defaultPrinter || 'None'})</option>
              {printers.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <button 
              onClick={handlePrint} 
              disabled={!file || isPrinting}
              style={{ paddingLeft: '2rem', paddingRight: '2rem' }}
            >
              {isPrinting ? <Loader2 className="spinner" size={16} /> : <FileText size={16} />}
              Print
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
