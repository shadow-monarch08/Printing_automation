import React, { useState } from 'react';
import { Printer, Usb, Wifi, Edit3, Trash2, RefreshCw } from 'lucide-react';
import type { BackendPrinter } from '../../types';
import { Button } from '../shared/Button';
import { useAdminStore } from '../../stores/useAdminStore';
import { useToast } from '../../context/ToastContext';

interface PrinterCardProps {
  printer: BackendPrinter;
  onEditAlias: (name: string, alias?: string) => void;
  onSetDefault: (name: string) => void;
  onDeletePrinter: (name: string) => void;
}

const getPaperColor = (status: string) => {
  if (status === 'ready') return 'var(--text-primary)';
  if (status === 'empty') return 'var(--status-error)';
  if (status === 'offline') return 'var(--text-muted)';
  return 'var(--text-muted)';
};

const RefreshPrinterButton = ({ printerName }: { printerName: string }) => {
  const { forceRefreshPrinter } = useAdminStore();
  const { addToast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <Button
      variant="ghost"
      style={{ padding: '0.2rem', minWidth: 'auto', marginLeft: 'auto' }}
      isLoading={isRefreshing}
      onClick={async () => {
        setIsRefreshing(true);
        try {
          const success = await forceRefreshPrinter(printerName);
          if (success) {
            addToast({ type: 'success', title: 'Refreshed', description: `Health status for ${printerName} updated.` });
          } else {
            addToast({ type: 'error', title: 'Refresh Failed', description: `Failed to refresh ${printerName}.` });
          }
        } catch (e: any) {
          addToast({ type: 'error', title: 'Refresh Error', description: e.message || 'Unknown error' });
        } finally {
          setIsRefreshing(false);
        }
      }}
    >
      <RefreshCw size={14} className={isRefreshing ? "spin" : ""} />
    </Button>
  );
};

export const PrinterCard: React.FC<PrinterCardProps> = ({
  printer,
  onEditAlias,
  onSetDefault,
  onDeletePrinter,
}) => {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {printer.isDefault && (
        <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--accent-primary)', color: 'var(--bg-primary)', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 1rem', borderBottomLeftRadius: '2px' }}>
          DEFAULT
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--bg-surface-alt)', padding: '0.75rem', borderRadius: '2px', flexShrink: 0 }}>
          <Printer size={28} color={printer.status === 'error' ? 'var(--status-error)' : 'var(--text-primary)'} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{printer.alias || printer.name}</span>
            <Button variant="ghost" style={{ padding: '0.2rem', minWidth: 'auto' }} onClick={() => onEditAlias(printer.name, printer.alias)}>
              <Edit3 size={14} />
            </Button>
            <RefreshPrinterButton printerName={printer.name} />
          </h3>
          <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {printer.type === 'usb' ? <Usb size={14} /> : <Wifi size={14} />}
            <span className="data-mono" style={{ overflow: 'hidden', fontSize: '0.85rem', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{printer.description}</span>
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
          {printer.paper === 'unknown' ? (
            <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'var(--bg-surface-alt)', borderRadius: '4px', color: 'var(--text-muted)' }}>Unknown</span>
          ) : (
            <span className="data-mono" style={{ textTransform: 'capitalize' }}>{printer.paper}</span>
          )}
        </div>
        <div style={{ height: '4px', background: 'var(--bg-surface-alt)', borderRadius: '2px', overflow: 'hidden', marginBottom: '1rem' }}>
          <div style={{ height: '100%', width: printer.paper === 'unknown' ? '0%' : '100%', background: getPaperColor(printer.paper) }} />
        </div>

        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ink / Toner Levels</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '2px', alignItems: 'center' }}>
              <span>Black</span>
              {printer.supplyBlack !== null ? (
                <span className="data-mono">{printer.supplyBlack}%</span>
              ) : (
                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', background: 'var(--bg-surface-alt)', borderRadius: '2px', color: 'var(--text-muted)' }}>N/A</span>
              )}
            </div>
            <div style={{ height: '8px', background: 'var(--bg-surface-alt)', borderRadius: '1px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${printer.supplyBlack || 0}%`, background: printer.supplyBlack !== null ? '#333333' : 'transparent' }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '2px', alignItems: 'center' }}>
              <span>Color</span>
              {printer.supplyColor !== null ? (
                <span className="data-mono">{printer.supplyColor}%</span>
              ) : (
                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', background: 'var(--bg-surface-alt)', borderRadius: '2px', color: 'var(--text-muted)' }}>N/A</span>
              )}
            </div>
            <div style={{ height: '8px', background: 'var(--bg-surface-alt)', borderRadius: '1px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${printer.supplyColor || 0}%`, background: printer.supplyColor !== null ? 'linear-gradient(90deg, #00FFFF, #FF00FF, #FFFF00)' : 'transparent' }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
        {!printer.isDefault ? (
          <Button variant="ghost" style={{ flex: 1 }} onClick={() => onSetDefault(printer.name)}>
            Set as Default
          </Button>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <Button variant="ghost" style={{ padding: '0.5rem', color: 'var(--status-error)' }} onClick={() => onDeletePrinter(printer.name)}>
          <Trash2 size={18} />
        </Button>
      </div>
    </div>
  );
};
