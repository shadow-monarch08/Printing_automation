import React from 'react';

export interface SystemOfflineOverlayProps {
  title?: string;
  statusTag?: string;
  message?: string;
}

export const SystemOfflineOverlay: React.FC<SystemOfflineOverlayProps> = ({
  title = '[SYSTEM_OFFLINE]',
  statusTag = 'STATUS: NO_HARDWARE_TARGETS_AVAILABLE',
  message = 'Kiosk operations suspended. All local print hardware targets are currently offline, faulted, or paused by administration.'
}) => {
  return (
    <div 
      className="offline-banner-container"
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        maxWidth: '860px',
        width: 'calc(100% - 32px)',
        backgroundColor: 'var(--bg-surface)',
        border: '2px solid var(--status-error)',
        borderRadius: 'var(--radius-sm, 4px)',
        padding: '16px 24px',
        boxSizing: 'border-box',
        boxShadow: 'none',
      }}
    >
      {/* Corner Rivet / Bolt Accents */}
      <span
        style={{
          position: 'absolute',
          top: '4px',
          left: '8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--status-error)',
          opacity: 0.8,
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        ▪
      </span>
      <span
        style={{
          position: 'absolute',
          top: '4px',
          right: '8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--status-error)',
          opacity: 0.8,
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        ▪
      </span>

      {/* Banner Content Layout */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        {/* Left Status & Title Seam */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Pulsing Hazard LED Diode */}
          <div 
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '2px',
              border: '2px solid var(--status-error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-primary)',
              flexShrink: 0,
            }}
          >
            <div 
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '1px',
                backgroundColor: 'var(--status-error)',
                animation: 'pulseLed 1s infinite alternate',
                boxShadow: '0 0 6px var(--status-error)',
              }}
            />
          </div>

          <div>
            <h2 
              className="offline-title"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '15px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: 'var(--status-error)',
                margin: 0,
                textTransform: 'uppercase',
                lineHeight: 1.2,
              }}
            >
              {title}
            </h2>
            <div 
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: 'var(--status-error)',
                marginTop: '4px',
              }}
            >
              {statusTag}
            </div>
          </div>
        </div>

        {/* Message Readout */}
        <p 
          className="offline-desc"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            margin: 0,
            lineHeight: 1.4,
            flex: 1,
            minWidth: '240px',
          }}
        >
          {message}
        </p>
      </div>

      <style>{`
        @keyframes pulseLed {
          0% { opacity: 0.3; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};
