// src/layouts/UserLayout.tsx
import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/shared/Button';

export function UserLayout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="user-layout">
      <header className="user-header">
        <div>
          <h1 className="user-header-title">Modern Press</h1>
          <div className="data-mono user-header-sub">// PRINT QUEUE SYSTEM</div>
        </div>
        
        <Button 
          variant='ghost' 
          onClick={toggleTheme} 
          aria-label="Toggle theme"
          style={{ padding: '0.5rem' }}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </Button>
      </header>
      
      <main className="user-main" style={{ paddingBottom: '80px' }}>
        {children}
      </main>

      <footer className="user-footer">
        <p>Built for efficiency. Powered by Modern Press local infrastructure.</p>
      </footer>
    </div>
  );
}
