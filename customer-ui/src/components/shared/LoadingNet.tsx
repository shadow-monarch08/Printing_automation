export function LoadingNet({ message = 'Loading...', compact = false }: { message?: string; compact?: boolean }) {
  if (compact) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          height: '100%',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '28px',
            height: '18px',
            backgroundColor: 'var(--bg-paper)',
            border: '1px solid var(--border-default)',
            borderRadius: '2px',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* Moving Horizontal Printhead Bar */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '2px',
              backgroundColor: 'var(--accent-primary)',
              boxShadow: '0 0 6px var(--accent-primary)',
              animation: 'printScanCompact 1.2s infinite ease-in-out',
              zIndex: 3,
            }}
          />
        </div>
        {message && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--accent-primary)',
            }}
          >
            {message.toUpperCase()}
          </span>
        )}
        <style>{`
          @keyframes printScanCompact {
            0% { top: 2px; }
            50% { top: 14px; }
            100% { top: 2px; }
          }
        `}</style>
      </div>
    );
  }

  const formattedMessage = message.toUpperCase().startsWith('▪') 
    ? message.toUpperCase() 
    : `▪ ${message.toUpperCase()}`;

  return (
    <div 
      className="loading-net-container" 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: '300px',
        padding: '2rem',
        gap: '16px',
        margin: 'auto',
        boxSizing: 'border-box'
      }}
    >
      {/* Retro Dot-Matrix Paper Box */}
      <div 
        style={{
          position: 'relative',
          width: '120px',
          height: '80px',
          backgroundColor: 'var(--bg-paper)',
          border: '1px solid var(--border-default)',
          borderRadius: '2px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-paper)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '6px 4px'
        }}
      >
        {/* Left Tractor-Feed Holes */}
        <div style={{ position: 'absolute', left: '4px', top: '8px', bottom: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 2, pointerEvents: 'none' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={`l-${i}`} style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>

        {/* Right Tractor-Feed Holes */}
        <div style={{ position: 'absolute', right: '4px', top: '8px', bottom: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 2, pointerEvents: 'none' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={`r-${i}`} style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>

        {/* Inner Print Lines Representation */}
        <div style={{ width: '100%', height: '100%', padding: '0 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', opacity: 0.25 }}>
          <div style={{ height: '2px', backgroundColor: 'var(--text-primary)', width: '80%' }} />
          <div style={{ height: '2px', backgroundColor: 'var(--text-primary)', width: '100%' }} />
          <div style={{ height: '2px', backgroundColor: 'var(--text-primary)', width: '60%' }} />
          <div style={{ height: '2px', backgroundColor: 'var(--text-primary)', width: '90%' }} />
        </div>

        {/* Moving Horizontal Printhead Bar */}
        <div 
          className="printhead-bar"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '2px',
            backgroundColor: 'var(--accent-primary)',
            boxShadow: '0 0 8px var(--accent-primary)',
            animation: 'printScan 1.8s infinite ease-in-out',
            zIndex: 3
          }}
        />
      </div>

      {/* Monospace Status Readout */}
      <div 
        className="data-mono" 
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'var(--accent-primary)',
          textAlign: 'center'
        }}
      >
        {formattedMessage}
      </div>

      <style>{`
        @keyframes printScan {
          0% { top: 4px; }
          50% { top: 74px; }
          100% { top: 4px; }
        }
      `}</style>
    </div>
  );
}
