import React from 'react';

export interface SystemOfflineOverlayProps {
  title?: string;
  statusTag?: string;
  message?: string;
}

export const SystemOfflineOverlay: React.FC<SystemOfflineOverlayProps> = ({
  title = '[SYSTEM_OFFLINE]',
  statusTag = 'STATUS: NO_HARDWARE_TARGETS_AVAILABLE',
  message = 'Kiosk operations have been suspended. All local print hardware targets are currently offline, faulted, or paused by administration.'
}) => {
  return (
    <div 
      className="offline-screen-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'var(--bg-primary)',
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div 
        className="offline-panel"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '2px solid var(--status-error)',
          borderRadius: 'var(--radius-md, 4px)',
          padding: '48px 32px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--status-error)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
      >
        {/* Top Pulsing LED Hazard Diode */}
        <div 
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '2px',
            border: '2px solid var(--status-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            backgroundColor: 'var(--bg-primary)'
          }}
        >
          <div 
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '1px',
              backgroundColor: 'var(--status-error)',
              animation: 'pulseLed 1s infinite alternate',
              boxShadow: '0 0 8px var(--status-error)'
            }}
          />
        </div>

        <h2 
          className="offline-title"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '20px',
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: 'var(--status-error)',
            margin: '0 0 8px 0',
            textTransform: 'uppercase'
          }}
        >
          {title}
        </h2>

        <div 
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: 'var(--status-error)',
            backgroundColor: 'rgba(255, 68, 68, 0.1)',
            border: '1px solid var(--status-error)',
            padding: '4px 10px',
            borderRadius: '2px',
            marginBottom: '12px'
          }}
        >
          {statusTag}
        </div>

        <p 
          className="offline-desc"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            marginTop: '16px',
            marginBottom: 0,
            lineHeight: 1.6
          }}
        >
          {message}
        </p>
      </div>

      <style>{`
        @keyframes pulseLed {
          0% { opacity: 0.2; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};
