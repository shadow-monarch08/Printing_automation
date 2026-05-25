import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Modal } from './components/shared/Modal';
import { ToastStack } from './components/shared/ToastStack';
import { AlertTriangle } from 'lucide-react';
import { LoadingNet } from './components/shared/LoadingNet';

import { UserLayout } from './layouts/UserLayout';
import { ProgressBar } from './components/user/ProgressBar';
import { DropZone } from './pages/user/DropZone';
import { ConfigConsole } from './pages/user/ConfigConsole';
import { QuoteReceipt } from './pages/user/QuoteReceipt';
import { JobTracker } from './pages/user/JobTracker';
import { ActiveJobIndicator } from './components/user/ActiveJobIndicator';
import { useUserPrintStore } from './stores/useUserPrintStore';

import { AdminLayout } from './layouts/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { Fleet } from './pages/admin/Fleet';
import { Queue } from './pages/admin/Queue';
import { Settings } from './pages/admin/Settings';

function UserKioskPage() {
  const currentStep = useUserPrintStore(s => s.currentStep);
  const isAcceptingJobs = useUserPrintStore(s => s.isAcceptingJobs);
  const fetchKioskStatus = useUserPrintStore(s => s.fetchKioskStatus);

  useEffect(() => {
    fetchKioskStatus();
  }, [fetchKioskStatus]);

  if (isAcceptingJobs === null) {
    return <LoadingNet message="Checking system status..." />;
  }

  if (isAcceptingJobs === false) {
    return (
      <div className="offline-container" style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.8 }}>
        <AlertTriangle size={64} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
        <h2 className="offline-title">System Offline</h2>
        <p className="offline-desc" style={{ color: 'var(--danger)', textAlign: "center" }}>No printers are currently available. Please check back later.</p>
      </div>
    );
  }

  return (
    <>
      <ProgressBar />
      {currentStep === 1 && <DropZone />}
      {currentStep === 2 && <ConfigConsole />}
      {currentStep === 3 && <QuoteReceipt />}
      {currentStep === 4 && <JobTracker />}
      <ActiveJobIndicator />
    </>
  );
}

import { WifiSetup } from './components/user/WifiSetup';
import { useAdminStore } from './stores/useAdminStore';

function App() {
  const { isSetupMode, checkSetupMode } = useAdminStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSetupMode().finally(() => setLoading(false));
  }, [checkSetupMode]);

  if (loading) return null;

  if (isSetupMode) {
    return <WifiSetup />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<UserLayout><UserKioskPage /></UserLayout>} />
        <Route path="/admin" element={<AdminLayout><Dashboard /></AdminLayout>} />
        <Route path="/admin/fleet" element={<AdminLayout><Fleet /></AdminLayout>} />
        <Route path="/admin/queue" element={<AdminLayout><Queue /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><Settings /></AdminLayout>} />
      </Routes>
      <Modal />
      <ToastStack />
    </>
  );
}

export default App;
