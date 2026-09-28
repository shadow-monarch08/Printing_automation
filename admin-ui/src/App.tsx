import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Modal } from './components/shared/Modal';
import { ToastStack } from './components/shared/ToastStack';

import { AdminLayout } from './layouts/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { Fleet } from './pages/admin/Fleet';
import { Queue } from './pages/admin/Queue';
import { Settings } from './pages/admin/Settings';
import { Analytics } from './pages/admin/Analytics';
import { Network } from './pages/admin/Network';

import { OnboardingLayout } from './layouts/OnboardingLayout';
import { useAdminStore } from './stores/useAdminStore';

function App() {
  const { isOnboarded, checkSetupMode } = useAdminStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSetupMode().finally(() => setLoading(false));
  }, [checkSetupMode]);

  if (loading) return null;

  const renderMainContent = () => {
    // 1. Unprovisioned Setup Wizard (Admin Smartphone on Hotspot)
    if (!isOnboarded) {
      return <OnboardingLayout />;
    }

    // 2. Operational Routes (Admin Control Room)
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/onboarding" element={<OnboardingLayout />} />
        <Route path="/admin" element={<AdminLayout><Dashboard /></AdminLayout>} />
        <Route path="/admin/fleet" element={<AdminLayout><Fleet /></AdminLayout>} />
        <Route path="/admin/queue" element={<AdminLayout><Queue /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><Settings /></AdminLayout>} />
        <Route path="/admin/network" element={<AdminLayout><Network /></AdminLayout>} />
        <Route path="/admin/analytics" element={<AdminLayout><Analytics /></AdminLayout>} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
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
