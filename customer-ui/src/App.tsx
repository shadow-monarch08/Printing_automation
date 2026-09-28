import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
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

function UserKioskPage() {
  const currentStep = useUserPrintStore(s => s.currentStep);
  const isAcceptingJobs = useUserPrintStore(s => s.isAcceptingJobs);
  const fetchKioskStatus = useUserPrintStore(s => s.fetchKioskStatus);
  const sessionId = useUserPrintStore(s => s.sessionId);
  const initSession = useUserPrintStore(s => s.initSession);

  useEffect(() => {
    fetchKioskStatus();
    if (!sessionId) {
      initSession();
    }
  }, [fetchKioskStatus, sessionId, initSession]);

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

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<UserLayout><UserKioskPage /></UserLayout>} />
        <Route path="*" element={<UserLayout><UserKioskPage /></UserLayout>} />
      </Routes>
      <Modal />
      <ToastStack />
    </>
  );
}

export default App;
