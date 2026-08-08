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
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '360px', width: '100%' }}>
        <LoadingNet message="Checking system status..." />
      </div>
    );
  }

  if (isAcceptingJobs === false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 'calc(60vh - 80px)', width: '100%', margin: 'auto 0' }}>
        <SystemOfflineOverlay />
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

import { OnboardingLayout } from './layouts/OnboardingLayout';
import { useAdminStore } from './stores/useAdminStore';

function App() {
  const { isSetupMode, isOnboarded, checkSetupMode } = useAdminStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSetupMode().finally(() => setLoading(false));
  }, [checkSetupMode]);

  if (loading) return null;

  const renderMainContent = () => {
    if (!isOnboarded) {
      return <OnboardingLayout mode="full" />;
    }

    if (isSetupMode) {
      return <OnboardingLayout mode="wifi-only" />;
    }

    return (
      <Routes>
        <Route path="/" element={<UserLayout><UserKioskPage /></UserLayout>} />
        <Route path="/onboarding" element={<OnboardingLayout />} />
        <Route path="/admin" element={<AdminLayout><Dashboard /></AdminLayout>} />
        <Route path="/admin/fleet" element={<AdminLayout><Fleet /></AdminLayout>} />
        <Route path="/admin/queue" element={<AdminLayout><Queue /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><Settings /></AdminLayout>} />
        <Route path="/admin/analytics" element={<AdminLayout><Analytics /></AdminLayout>} />
      </Routes>
    );
  };

  return (
    <>
      {renderMainContent()}
      <Modal />
      <ToastStack />
    </>
  );
}

export default App;
