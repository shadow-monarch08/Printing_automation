import React, { useState } from 'react';
import { Printer, Usb, Wifi, Edit3, Trash2, RefreshCw, Check } from 'lucide-react';
import type { BackendPrinter } from '../../types';
import { Button } from '../shared/Button';
import { useAdminStore } from '../../stores/useAdminStore';
import { useToast } from '../../context/ToastContext';
import { soundFx } from '../../utils/sound';

export interface PrinterCardProps {
  printer: BackendPrinter;
  onEditAlias?: (printerName: string, currentAlias?: string) => void;
  onRefresh?: (printerName: string) => void;
  onSetDefault: (printerName: string) => void;
  onDeletePrinter?: (printerName: string) => void;
  onDelete?: (printer: BackendPrinter) => void;
  isRefreshing?: boolean;
}

const getPaperColor = (status: string) => {
  if (status === 'ready') return 'var(--accent-primary)';
  if (status === 'empty') return 'var(--status-error)';
  return 'var(--text-muted)';
};

const getStatusLedColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'idle':
    case 'ready':
      return 'var(--status-idle)';
    case 'busy':
    case 'printing':
    case 'spooling':
      return 'var(--status-busy)';
    case 'error':
      return 'var(--status-error)';
    case 'offline':
    default:
      return 'var(--text-muted)';
  }
};

export const PrinterCard: React.FC<PrinterCardProps> = ({
  printer,
  onEditAlias,
  onRefresh,
  onSetDefault,
  onDeletePrinter,
  onDelete,
  isRefreshing: propIsRefreshing = false,
}) => {
  const { forceRefreshPrinter } = useAdminStore();
  const { addToast } = useToast();
  const [internalRefreshing, setInternalRefreshing] = useState(false);

  const isRefreshing = propIsRefreshing || internalRefreshing;

  const handleRefreshClick = async () => {
    soundFx.playClick();
    if (onRefresh) {
      onRefresh(printer.name);
      return;
    }

    setInternalRefreshing(true);
    try {
      const success = await forceRefreshPrinter(printer.name);
      if (success) {
        addToast({ type: 'success', title: 'Refreshed', description: `Health status for ${printer.name} updated.` });
      } else {
        addToast({ type: 'error', title: 'Refresh Failed', description: `Failed to refresh ${printer.name}.` });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Refresh Error', description: e.message || 'Unknown error' });
    } finally {
      setInternalRefreshing(false);
    }
  };

  const handleEditClick = () => {
    soundFx.playClick();
    if (onEditAlias) {
      onEditAlias(printer.name, printer.alias);
    }
  };

  const handleDeleteClick = () => {
    soundFx.playClick();
    if (onDelete) {
      onDelete(printer);
    } else if (onDeletePrinter) {
      onDeletePrinter(printer.name);
    }
  };

  const ledColor = getStatusLedColor(printer.status);

  return (
    <div 
      className="card printer-card-module"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-sm, 2px)',
        padding: '20px',
        boxShadow: 'var(--shadow-paper)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Stenciled Default Ribbon */}
      {printer.isDefault && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'var(--accent-primary)',
            color: 'var(--btn-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '3px 12px',
            borderBottomLeftRadius: '2px',
            textTransform: 'uppercase'
          }}
        >
          DEFAULT
        </div>
      )}

      {/* Device Hardware Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
        {/* Recessed Hardware Icon Badge */}
        <div 
          style={{
            background: 'var(--bg-primary)',
            padding: '10px',
            borderRadius: '2px',
            border: '1px solid var(--border-default)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Printer size={20} color={printer.status === 'error' ? 'var(--status-error)' : 'var(--text-primary)'} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <h3 
              style={{ 
                margin: 0, 
                fontFamily: 'var(--font-mono)', 
                fontSize: '1.05rem', 
                fontWeight: 700, 
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                borderBottom: 'none',
                paddingBottom: 0
              }}
            >
              {printer.alias || printer.name}
            </h3>

            {/* Recessed Edit Trigger */}
            <button
              type="button"
              onClick={handleEditClick}
              title="Edit Alias"
              style={{
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: '2px',
                padding: '2px 4px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <Edit3 size={14} />
            </button>

            {/* Recessed Refresh Trigger */}
            <button
              type="button"
              onClick={handleRefreshClick}
              title="Refresh Printer Health"
              disabled={isRefreshing}
              style={{
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: '2px',
                padding: '2px 4px',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 'auto',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!isRefreshing) {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <RefreshCw size={14} className={isRefreshing ? "spin-anim" : ""} />
            </button>
          </div>

          {/* Protocol Line */}
          <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {printer.type === 'usb' ? <Usb size={12} /> : <Wifi size={12} />}
            <span 
              className="data-mono" 
              style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '11px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                opacity: 0.85
              }}
            >
              {printer.description}
            </span>
          </div>
        </div>
      </div>

      {/* Consumables & Analog Meters Section */}
      <div style={{ marginBottom: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Hardware Status Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
            STATUS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span 
              className="pulse-led"
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '1px',
                backgroundColor: ledColor,
                display: 'inline-block',
                boxShadow: `0 0 5px ${ledColor}`
              }} 
            />
            <span className={`badge badge-${printer.status}`} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase' }}>
              {printer.status}
            </span>
          </div>
        </div>

        {/* Paper Tray Meter */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAPER TRAY</span>
            {printer.paper === 'unknown' ? (
              <span style={{ fontSize: '10px', padding: '1px 4px', background: 'var(--bg-surface-alt)', borderRadius: '2px', color: 'var(--text-muted)' }}>UNKNOWN</span>
            ) : (
              <span className="data-mono" style={{ textTransform: 'uppercase', fontWeight: 600 }}>{printer.paper}</span>
            )}
          </div>
          <div style={{ height: '5px', background: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
            <div style={{ height: '100%', width: printer.paper === 'unknown' ? '50%' : printer.paper === 'ready' ? '100%' : '0%', background: getPaperColor(printer.paper) }} />
          </div>
        </div>

        {/* Ink / Toner Levels */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            INK / TONER LEVELS
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Black Toner */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>BLACK</span>
                {printer.supplyBlack !== null ? (
                  <span className="data-mono" style={{ fontWeight: 600 }}>{printer.supplyBlack}%</span>
                ) : (
                  <span style={{ fontSize: '9px', padding: '0 4px', background: 'var(--bg-surface-alt)', borderRadius: '2px', color: 'var(--text-muted)' }}>N/A</span>
                )}
              </div>
              <div style={{ height: '8px', background: 'var(--bg-primary)', borderRadius: '1px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                <div style={{ height: '100%', width: `${printer.supplyBlack || 0}%`, background: printer.supplyBlack !== null ? 'var(--text-primary)' : 'transparent' }} />
              </div>
            </div>

            {/* CMYK Color Toner */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>CMYK</span>
                {printer.supplyColor !== null ? (
                  <span className="data-mono" style={{ fontWeight: 600 }}>{printer.supplyColor}%</span>
                ) : (
                  <span style={{ fontSize: '9px', padding: '0 4px', background: 'var(--bg-surface-alt)', borderRadius: '2px', color: 'var(--text-muted)' }}>UNSUPPORTED</span>
                )}
              </div>
              <div style={{ height: '8px', background: 'var(--bg-primary)', borderRadius: '1px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${printer.supplyColor || 0}%`, 
                    background: printer.supplyColor !== null ? 'linear-gradient(90deg, #00FFFF, #FF00FF, #FFFF00)' : 'transparent' 
                  }} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer Mechanics */}
      <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
        {!printer.isDefault ? (
          <Button 
            variant="ghost" 
            style={{ flex: 1, fontSize: '11px', padding: '6px 12px' }} 
            onClick={() => onSetDefault(printer.name)} 
            disabled={printer.status === 'offline'}
          >
            SET AS DEFAULT
          </Button>
        ) : (
          <div 
            style={{ 
              flex: 1, 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '4px', 
              fontFamily: 'var(--font-mono)', 
              fontSize: '11px', 
              fontWeight: 700, 
              color: 'var(--accent-primary)',
              letterSpacing: '0.05em'
            }}
          >
            <Check size={14} /> PRIMARY TARGET
          </div>
        )}

        <Button 
          variant="danger" 
          style={{ padding: '6px 10px' }} 
          onClick={handleDeleteClick} 
          aria-label="Delete Printer"
        >
          <Trash2 size={15} />
        </Button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};
