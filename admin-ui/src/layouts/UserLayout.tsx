import type { ReactNode } from 'react';
import { FloatingControlsWidget } from '../components/user/FloatingControlsWidget';
import { useUserPrintStore } from '../stores/useUserPrintStore';
import { useAdminStore } from '../stores/useAdminStore';

export function UserLayout({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  const isAcceptingJobs = useUserPrintStore(s => s.isAcceptingJobs);
  const shopName = useAdminStore(s => s.shopName) || 'PRINT_AUTOMATION';
  const isOffline = isAcceptingJobs === false;

  return (
    <div className="user-layout kiosk-mobile-root">
      <header className="user-header">
        <div className="user-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h1 className="user-header-title" style={{ margin: 0 }}>{shopName.toUpperCase()}</h1>
          <span className="user-header-sub" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
            // KIOSK_TERMINAL_01
          </span>
          {subtitle && <span className="data-mono user-header-sub" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>• {subtitle}</span>}
        </div>
        
        <div className="user-header-controls" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Live Status Indicator */}
          <div 
            className="kiosk-status-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isOffline ? 'rgba(255, 68, 68, 0.1)' : 'var(--bg-surface-alt)',
              border: `1px solid ${isOffline ? 'var(--status-error)' : 'var(--border-default)'}`,
              padding: '4px 8px',
              borderRadius: '2px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: isOffline ? 'var(--status-error)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              transition: 'all 0.3s ease'
            }}
          >
            <div 
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isOffline ? 'var(--status-error)' : 'var(--status-idle, #10B981)',
                boxShadow: `0 0 6px ${isOffline ? 'var(--status-error)' : 'var(--status-idle, #10B981)'}`,
                animation: 'pulseLed 1.5s infinite alternate',
                flexShrink: 0
              }}
            />
            <span>{isOffline ? 'OFFLINE' : 'ONLINE'}</span>
          </div>
        </div>
      </header>
      
      <main className="user-main kiosk-step-content-container">
        {children}

        <footer className="user-footer" style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-default)', textAlign: 'center' }}>
          <div className="ticker-bar" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.05em', color: isOffline ? 'var(--status-error)' : 'var(--text-secondary)' }}>
            {isOffline 
              ? 'SYSTEM: OFFLINE | HARDWARE: UNAVAILABLE | SPOOLER: PAUSED' 
              : 'SYSTEM: ONLINE | PAPER: READY | CMYK: ACTIVE'}
          </div>
        </footer>
      </main>

      {/* Floating Draggable Sound & Theme Controls */}
      <FloatingControlsWidget />
    </div>
  );
}
