// src/pages/admin/Dashboard.tsx
import { useEffect, useState } from 'react';
import { useAdminStore } from '../../stores/useAdminStore';
import { Activity, Printer, Layers, DollarSign } from 'lucide-react';
import type { ReactNode } from 'react';
import { LoadingScreen } from '../../components/shared/LoadingScreen';

export function Dashboard() {
  const { metrics, loadMetrics } = useAdminStore();
  const [liveUptime, setLiveUptime] = useState<number>(0);

  useEffect(() => {
    loadMetrics();
    // 25s Poll for metrics (CPU Load, Revenue, Job counts etc)
    const metricsInterval = setInterval(loadMetrics, 25000);
    return () => clearInterval(metricsInterval);
  }, [loadMetrics]);

  // Handle Uptime Tick (Every 1s)
  useEffect(() => {
    if (metrics?.uptimeSeconds) {
      setLiveUptime(metrics.uptimeSeconds);
    }
  }, [metrics?.uptimeSeconds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveUptime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  if (!metrics) return <LoadingScreen message="Linking to hardware layer..." />;

  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Overview</h1>
        <p className="page-desc">System telemetry and high-level metrics</p>
      </header>

      <div className="dashboard-metrics">
        <MetricCard label="Active Printers" value={`${metrics.activePrinters ?? '?'} / ${metrics.totalPrinters ?? '?'}`} icon={<Printer />} />
        <MetricCard label="Queued Jobs" value={metrics.waiting + metrics.active} icon={<Layers />} alert={metrics.waiting + metrics.active > 10} />
        <MetricCard label="Jobs Today" value={metrics.totalJobsToday ?? (metrics.completed + metrics.failed)} icon={<Activity />} />
        <MetricCard label="Gross Revenue" value={`₹${metrics.revenue ?? '0.00'}`} icon={<DollarSign />} />
      </div>

      <div className="dashboard-detail-grid">
         <div className="card">
            <h3 style={{ marginBottom: '1.5rem' }}>System Health</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
               <HealthMeter label="CPU Load" value={metrics.cpuLoad ?? 0} />
               <HealthMeter label="Failed Jobs (Today)" value={metrics.totalJobsToday ? Math.round((metrics.failed / metrics.totalJobsToday) * 100) : 0} />
               <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--border-default)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Uptime</span>
                  <span className="data-mono">{formatUptime(liveUptime)}</span>
               </div>
            </div>
         </div>
         
         <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
               <Activity size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
               <p>Real-time graph placeholder</p>
            </div>
         </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, alert }: { label: string, value: string | number, icon: ReactNode, alert?: boolean }) {
  return (
    <div className="card" style={{ borderLeft: alert ? '3px solid var(--status-error)' : '3px solid var(--accent-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        {icon}
      </div>
      <div className="data-mono metric-value" style={{ color: alert ? 'var(--status-error)' : 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function HealthMeter({ label, value }: { label: string, value: number }) {
   const isWarning = value > 80;
   return (
     <div>
       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          <span>{label}</span>
          <span className="data-mono" style={{ color: isWarning ? 'var(--status-error)' : 'inherit' }}>{value}%</span>
       </div>
       <div style={{ height: '6px', background: 'var(--bg-surface-alt)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${value}%`, background: isWarning ? 'var(--status-error)' : 'var(--status-idle)' }} />
       </div>
     </div>
   );
}
