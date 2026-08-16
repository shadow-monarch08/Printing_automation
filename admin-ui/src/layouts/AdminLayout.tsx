// src/layouts/AdminLayout.tsx
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Lock, LayoutDashboard, Printer, ListOrdered, Settings, LogOut, Menu, X, Sun, Moon, BarChart3, Wifi } from 'lucide-react';
import { useAdminStore } from '../stores/useAdminStore';
import { Button } from '../components/shared/Button';
import { LoadingNet } from '../components/shared/LoadingNet';
import { PinInput } from '../components/shared/PinInput';

export function AdminLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, authenticate, logout, checkAuth, shopName } = useAdminStore();
  const displayShopName = shopName || 'PRINT_AUTOMATION';
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const navigate = useNavigate();

  const pinArray = [
    pinInput[0] || '',
    pinInput[1] || '',
    pinInput[2] || '',
    pinInput[3] || '',
  ];

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('printTheme', newTheme);
    setTheme(newTheme);
  };

  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAuth().finally(() => setIsChecking(false));
  }, [checkAuth]);

  const handleLogin = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    const success = await authenticate(pinInput);
    if (success) {
      setError(false);
    } else {
      setError(true);
      setPinInput('');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const closeSidebar = () => setSidebarOpen(false);



  if (isChecking) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <LoadingNet message="Verifying Admin Session Authentication..." />
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
          
          <div style={{ marginBottom: '1.5rem' }}>
            <PinInput
              label="[MASTER_ADMIN_PIN]"
              value={pinArray}
              onChange={(valArray) => {
                setPinInput(valArray.join(''));
                setError(false);
              }}
              error={error ? 'Invalid Authorization Code' : undefined}
              autoFocus
            />
          </div>

          <Button
            type="submit"
            variant="mechanical"
            onClick={handleLogin}
            disabled={pinInput.length !== 4}
            style={{ width: '100%', height: '44px', marginTop: '0.5rem' }}
          >
            Authenticate
          </Button>
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
          <h1>{displayShopName.toUpperCase()}</h1>
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
          <NavLink to="/admin/network" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <Wifi size={20} /> Network / Wi-Fi
          </NavLink>
          <NavLink to="/admin/analytics" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <BarChart3 size={20} /> Analytics
          </NavLink>
        </nav>

        <div className="admin-sidebar-footer">
            <Button variant="ghost" onClick={toggleTheme} style={{ width: '100%', marginBottom: '0.5rem' }}>
               {theme === 'dark' ? <><Sun size={18} style={{ marginRight: '0.5rem' }} /> Light Mode</> : <><Moon size={18} style={{ marginRight: '0.5rem' }} /> Dark Mode</>}
            </Button>
            <Button variant="ghost" onClick={handleLogout} style={{ width: '100%', color: 'var(--status-error)', borderColor: 'var(--status-error)' }}>
               <LogOut size={18} /> Close Session
            </Button>
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
