import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Modal } from './components/shared/Modal';
import { ToastStack } from './components/shared/ToastStack';
import { LoadingNet } from './components/shared/LoadingNet';

import { UserLayout } from './layouts/UserLayout';
import { ProgressBar } from './components/user/ProgressBar';
import { DropZone } from './pages/user/DropZone';
import { ConfigConsole } from './pages/user/ConfigConsole';
import { QuoteReceipt } from './pages/user/QuoteReceipt';
import { JobTracker } from './pages/user/JobTracker';
import { ActiveJobIndicator } from './components/user/ActiveJobIndicator';
import { SystemOfflineOverlay } from './components/user/SystemOfflineOverlay';
import { useUserPrintStore } from './stores/useUserPrintStore';

import { AdminLayout } from './layouts/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { Fleet } from './pages/admin/Fleet';
import { Queue } from './pages/admin/Queue';
import { Settings } from './pages/admin/Settings';
import { Analytics } from './pages/admin/Analytics';

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
    return <SystemOfflineOverlay />;
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
    return (
      <div style={{ minHeight: '100vh', padding: '2rem', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
        <WifiSetup />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<UserLayout><UserKioskPage /></UserLayout>} />
        <Route path="/admin" element={<AdminLayout><Dashboard /></AdminLayout>} />
        <Route path="/admin/fleet" element={<AdminLayout><Fleet /></AdminLayout>} />
        <Route path="/admin/queue" element={<AdminLayout><Queue /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><Settings /></AdminLayout>} />
        <Route path="/admin/analytics" element={<AdminLayout><Analytics /></AdminLayout>} />
      </Routes>
      <Modal />
      <ToastStack />
    </>
  );
}

export default App;
