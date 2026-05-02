export function LoadingNet({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      color: 'var(--text-secondary)'
    }}>
      <div className="loading-net" style={{ marginBottom: '1rem' }}>
        <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="netGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <g fill="none" stroke="url(#netGrad)" strokeWidth="1" opacity="0.8">
            <path d="M0 10 H40 M0 20 H40 M0 30 H40 M10 0 V40 M20 0 V40 M30 0 V40">
              <animate attributeName="stroke-dasharray" values="0, 40; 40, 0; 0, 40" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3; 1; 0.3" dur="1.5s" repeatCount="indefinite" />
            </path>
            <rect x="0" y="0" width="40" height="40" strokeWidth="2" stroke="var(--accent-primary)">
               <animate attributeName="opacity" values="0.2; 0.8; 0.2" dur="2s" repeatCount="indefinite" />
            </rect>
          </g>
        </svg>
      </div>
      <div className="data-mono" style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>
        {message}
      </div>
    </div>
  );
}
