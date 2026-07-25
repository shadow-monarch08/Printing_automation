import { useState, type ReactNode } from 'react';
import { Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/shared/Button';
import { soundFx } from '../utils/sound';

export function UserLayout({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [isMuted, setIsMuted] = useState(soundFx.getMuted());

  const handleToggleMute = () => {
    const nextMuted = soundFx.toggleMute();
    setIsMuted(nextMuted);
  };

  return (
    <div className="user-layout kiosk-mobile-root">
      <header className="user-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="user-header-title">PRINT_AUTOMATION</h1>
            <span className="user-header-sub" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
              // KIOSK_TERMINAL_01
            </span>
          </div>
          {subtitle && <div className="data-mono user-header-sub">{subtitle}</div>}
        </div>
        
        <div className="user-header-controls" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Live Status Indicator */}
          <div 
            className="kiosk-status-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-surface-alt)',
              border: '1px solid var(--border-default)',
              padding: '4px 8px',
              borderRadius: '2px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)'
            }}
          >
            <div 
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--status-idle, #10B981)',
                boxShadow: '0 0 6px var(--status-idle, #10B981)',
                animation: 'pulseLed 1.5s infinite alternate'
              }}
            />
            <span>ONLINE</span>
          </div>

          {/* Audio Mute Switch */}
          <Button 
            variant="ghost" 
            onClick={handleToggleMute} 
            aria-label="Toggle Mute"
            style={{ padding: '0.4rem', minHeight: '36px', minWidth: '36px' }}
          >
            {isMuted ? <VolumeX size={18} color="var(--status-error)" /> : <Volume2 size={18} />}
          </Button>

          {/* Theme Switcher */}
          <Button 
            variant="ghost" 
            onClick={toggleTheme} 
            aria-label="Toggle theme"
            style={{ padding: '0.4rem', minHeight: '36px', minWidth: '36px' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
        </div>
      </header>
      
      <main className="user-main kiosk-step-content-container">
        {children}
      </main>
      
      <footer className="user-footer">
        <div className="ticker-bar" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
          SYSTEM: ONLINE | PAPER: READY | CMYK: ACTIVE
        </div>
      </footer>
    </div>
  );
}
