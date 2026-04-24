// src/pages/admin/Fleet.tsx
import { useEffect } from 'react';
import { useAdminStore } from '../../stores/useAdminStore';
import { useToast } from '../../context/ToastContext';
import { Printer, Usb, Wifi, Search } from 'lucide-react';

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
      const uri = await detectLegacyPrinter();
      if (uri) {
          addToast({ type: 'warning', title: 'Legacy Device Detected', description: `Device configured at ${uri}. Restart required.` });
      }
  };

  const getInkColor = (key: string) => {
     switch(key) {
        case 'c': return '#00FFFF';
        case 'm': return '#FF00FF';
        case 'y': return '#FFFF00';
        case 'k': return '#333333';
        default: return '#CCC';
     }
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
           <div key={printer.id} className="card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
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
                    <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem' }}>{printer.name}</h3>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                       {printer.type === 'usb' ? <Usb size={14} /> : <Wifi size={14} />}
                       <span className="data-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{printer.model}</span>
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
                    <span className="data-mono">{printer.paperLevel}%</span>
                 </div>
                 <div style={{ height: '4px', background: 'var(--bg-surface-alt)', borderRadius: '2px', overflow: 'hidden', marginBottom: '1rem' }}>
                    <div style={{ height: '100%', width: `${printer.paperLevel}%`, background: printer.paperLevel < 20 ? 'var(--status-error)' : 'var(--text-primary)' }} />
                 </div>

                 <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ink / Toner Levels</div>
                 <div style={{ display: 'flex', gap: '0.25rem', height: '12px' }}>
                    {Object.entries(printer.inkLevels).map(([key, val]) => (
                       <div key={key} style={{ flex: 1, background: 'var(--bg-surface-alt)', borderRadius: '1px', position: 'relative' }}>
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${val}%`, background: getInkColor(key) }} />
                       </div>
                    ))}
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
    </div>
  );
}
