// src/components/shared/LoadingScreen.tsx
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({ message = 'Awaiting Telemetry...', fullScreen = false }: LoadingScreenProps) {
  const containerStyle: React.CSSProperties = fullScreen ? {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-primary)',
    zIndex: 9999,
  } : {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '3rem',
    minHeight: '200px'
  };

  return (
    <div style={containerStyle}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        
        <div style={{ position: 'relative', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           {/* Outer rotating ring */}
           <div style={{ 
             position: 'absolute', 
             inset: 0, 
             border: '2px solid var(--border-default)', 
             borderTopColor: 'var(--accent-primary)',
             borderRadius: '50%',
             animation: 'spin 1.5s linear infinite'
           }} />
           
           {/* Inner rotating element */}
           <Loader2 size={24} color="var(--text-muted)" style={{ animation: 'spin 2s ease-in-out infinite reverse' }} />
        </div>

        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', letterSpacing: '-0.02em', fontFamily: 'var(--font-sans)', display: fullScreen ? 'block' : 'none' }}>
            Modern Press
          </div>
          <div className="data-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', animation: 'pulse 1.5s infinite' }}>
            {message}
          </div>
        </div>

      </div>
    </div>
  );
}
