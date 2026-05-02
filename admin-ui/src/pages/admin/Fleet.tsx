// src/pages/admin/Fleet.tsx
import { useEffect } from 'react';
import { useAdminStore } from '../../stores/useAdminStore';
import { useToast } from '../../context/ToastContext';
import { Printer, Usb, Wifi, Search, PlusCircle } from 'lucide-react';
import { api } from '../../services/api';

export function Fleet() {
  const { printers, loadPrinters, setDefaultPrinter, detectLegacyPrinter, isDetecting } = useAdminStore();
  const { addToast } = useToast();

  useEffect(() => {
    loadPrinters();
  }, [loadPrinters]);

  const handleSetDefault = async (name: string) => {
     const success = await setDefaultPrinter(name);
     if (success) {
         addToast({ type: 'success', title: 'Default Updated', description: `${name} is now the primary target.` });
     }
  };

  const handleDetect = async () => {
      addToast({ type: 'info', title: 'Hardware Scan', description: 'Polling local USB and network ports for undocumented devices...', duration: 3000 });
      await detectLegacyPrinter();
      const count = useAdminStore.getState().detectedDevices.length;
      if (count > 0) {
          addToast({ type: 'success', title: 'Scan Complete', description: `Found ${count} unconfigured devices.` });
      } else {
          addToast({ type: 'warning', title: 'Scan Complete', description: `No new legacy devices found.` });
      }
  };

  const handleConfigure = async (uri: string, rawModel: string) => {
      try {
          const res = await api.configurePrinter(uri, rawModel);
          if (res.success) {
              addToast({ type: 'success', title: 'Device Configured', description: `${res.queueName || 'Printer'} added successfully.` });
              loadPrinters(); // Refresh fleet
              // Clear it from detected list
              useAdminStore.setState(state => ({
                  detectedDevices: state.detectedDevices.filter(d => d.uri !== uri)
              }));
          } else {
              addToast({ type: 'error', title: 'Configuration Failed', description: res.error || 'Unknown error' });
          }
      } catch (err: any) {
          addToast({ type: 'error', title: 'Configuration Failed', description: err.message || 'Unknown error' });
      }
  };

  const getPaperColor = (status: string) => {
    if (status === 'ready') return 'var(--text-primary)';
    if (status === 'empty') return 'var(--status-error)';
    return 'var(--text-muted)';
  };

  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <div className="fleet-header">
        <div>
          <h1 className="page-title">Hardware Fleet</h1>
          <p className="page-desc">Physical device topology and consumable levels</p>
        </div>
        <button className="btn-mechanical" onClick={handleDetect} disabled={isDetecting}>
            {isDetecting ? 'Scanning...' : 'Detect Legacy Hardware'} <Search size={18} />
        </button>
      </div>

      <div className="fleet-grid">
        {printers.map(printer => (
           <div key={printer.name} className="card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
              {printer.isDefault && (
                 <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--accent-primary)', color: 'var(--bg-primary)', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 1rem', borderBottomLeftRadius: '2px' }}>
                    DEFAULT
                 </div>
              )}
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
                 <div style={{ background: 'var(--bg-surface-alt)', padding: '0.75rem', borderRadius: '2px', flexShrink: 0 }}>
                     <Printer size={28} color={printer.status === 'error' ? 'var(--status-error)' : 'var(--text-primary)'} />
                 </div>
                 <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem' }}>{printer.alias || printer.name}</h3>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                       {printer.type === 'usb' ? <Usb size={14} /> : <Wifi size={14} />}
                       <span className="data-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{printer.description}</span>
                    </div>
                 </div>
              </div>

              <div style={{ marginBottom: '1.5rem', flex: 1 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                    <span className={`badge badge-${printer.status}`}>{printer.status}</span>
                 </div>
                 
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem', marginTop: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Paper Tray</span>
                    <span className="data-mono" style={{ textTransform: 'capitalize' }}>{printer.paper}</span>
                 </div>
                 <div style={{ height: '4px', background: 'var(--bg-surface-alt)', borderRadius: '2px', overflow: 'hidden', marginBottom: '1rem' }}>
                    <div style={{ height: '100%', width: printer.paper === 'unknown' ? '0%' : '100%', background: getPaperColor(printer.paper) }} />
                 </div>

                 <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ink / Toner Levels</div>
                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '2px' }}>
                          <span>Black</span>
                          <span className="data-mono">{printer.supplyBlack !== null ? `${printer.supplyBlack}%` : '?'}</span>
                       </div>
                       <div style={{ height: '8px', background: 'var(--bg-surface-alt)', borderRadius: '1px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${printer.supplyBlack || 0}%`, background: '#333333' }} />
                       </div>
                    </div>
                    <div style={{ flex: 1 }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '2px' }}>
                          <span>Color</span>
                          <span className="data-mono">{printer.supplyColor !== null ? `${printer.supplyColor}%` : '?'}</span>
                       </div>
                       <div style={{ height: '8px', background: 'var(--bg-surface-alt)', borderRadius: '1px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${printer.supplyColor || 0}%`, background: 'linear-gradient(90deg, #00FFFF, #FF00FF, #FFFF00)' }} />
                       </div>
                    </div>
                 </div>
              </div>

              {!printer.isDefault && (
                 <button className="btn-ghost" style={{ width: '100%' }} onClick={() => handleSetDefault(printer.name)}>
                    Set as Default
                 </button>
              )}
           </div>
        ))}
      </div>

      {useAdminStore.getState().detectedDevices.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Discovered Devices</h2>
          <div className="fleet-grid">
            {useAdminStore.getState().detectedDevices.map(device => (
              <div key={device.uri} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>{device.makeModel}</h3>
                  <div className="data-mono" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{device.uri}</div>
                </div>
                <button className="btn-mechanical" style={{ padding: '0.5rem 1rem' }} onClick={() => handleConfigure(device.uri, device.makeModel)}>
                  Configure <PlusCircle size={16} style={{ marginLeft: '0.5rem' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
