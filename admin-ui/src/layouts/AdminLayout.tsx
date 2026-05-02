// src/layouts/AdminLayout.tsx
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Lock, LayoutDashboard, Printer, ListOrdered, Settings, LogOut, Menu, X } from 'lucide-react';
import { useAdminStore } from '../stores/useAdminStore';

export function AdminLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, authenticate, logout, checkAuth } = useAdminStore();
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAuth().finally(() => setIsChecking(false));
  }, [checkAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await authenticate(pinInput);
    if (success) {
      setError(false);
    } else {
      setError(true);
      setPinInput('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const closeSidebar = () => setSidebarOpen(false);

  if (isChecking) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '1rem' }}>
        <form onSubmit={handleLogin} className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <Lock size={48} color="var(--text-muted)" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Admin Access</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Authentication required</p>
          
          <input 
            type="password" 
            className="input-field" 
            placeholder="Enter PIN" 
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.2em', marginBottom: '1rem', borderColor: error ? 'var(--status-error)' : 'var(--input-border)' }}
            autoFocus
          />
          {error && <p style={{ color: 'var(--status-error)', fontSize: '0.85rem', marginBottom: '1rem' }}>Invalid Authorization Code</p>}
          
          <button type="submit" className="btn-mechanical" style={{ width: '100%' }}>
            Authenticate
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* Backdrop for mobile */}
      <div className={`admin-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={closeSidebar}></div>

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-brand">
          <h1>Modern Press</h1>
          <div className="data-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CONTROL ROOM</div>
        </div>
        
        <nav className="admin-sidebar-nav">
          <NavLink to="/admin" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <LayoutDashboard size={20} /> Dashboard
          </NavLink>
          <NavLink to="/admin/fleet" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <Printer size={20} /> Hardware Fleet
          </NavLink>
          <NavLink to="/admin/queue" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <ListOrdered size={20} /> Master Queue
          </NavLink>
          <NavLink to="/admin/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <Settings size={20} /> Pricing & Settings
          </NavLink>
        </nav>

        <div className="admin-sidebar-footer">
           <button className="btn-ghost" onClick={handleLogout} style={{ width: '100%', color: 'var(--status-error)', borderColor: 'var(--status-error)' }}>
              <LogOut size={18} /> Close Session
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {children}
      </main>

      {/* Mobile Toggle FAB */}
      <button 
        className="btn-mechanical admin-mobile-toggle" 
        onClick={() => setSidebarOpen(prev => !prev)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <style>{`
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 2px;
          color: var(--text-secondary);
          transition: all 0.2s;
          font-weight: 500;
          text-decoration: none;
        }
        .sidebar-link:hover {
          background: var(--bg-surface-hover);
          color: var(--text-primary);
        }
        .sidebar-link.active {
          background: var(--accent-glow);
          color: var(--accent-primary);
          border-left: 3px solid var(--accent-primary);
        }
      `}</style>
    </div>
  );
}
