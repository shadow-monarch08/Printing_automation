// src/pages/admin/Dashboard.tsx
import { useEffect, useState } from 'react';
import { useAdminStore } from '../../stores/useAdminStore';
import { Activity, Printer, Layers, DollarSign, AlertOctagon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useModal } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/shared/Button';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard() {
  const { metrics, metricsHistory, loadMetrics, loadMetricsHistory, emergencyStop, loadQueue } = useAdminStore();
  const [liveUptime, setLiveUptime] = useState<number>(0);
  const { openModal, closeModal } = useModal();
  const { addToast } = useToast();
  const [isEmergencyStopping, setIsEmergencyStopping] = useState(false);

  useEffect(() => {
    loadMetrics();
    loadMetricsHistory();
    // 25s Poll for metrics
    const metricsInterval = setInterval(() => {
      loadMetrics();
      loadMetricsHistory();
    }, 25000);
    return () => clearInterval(metricsInterval);
  }, [loadMetrics, loadMetricsHistory]);

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

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleEmergencyStopClick = () => {
    openModal({
      title: 'EMERGENCY STOP',
      content: (
        <div>
          <p style={{ color: 'var(--status-error)', fontWeight: 600, marginBottom: '1rem' }}>
            Are you sure? This will obliterate ALL jobs.
          </p>
          <p>
            This action will completely wipe the BullMQ queue and cancel all active print jobs at the operating system level (CUPS). Users will not be refunded automatically.
          </p>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" onClick={closeModal}>Abort</Button>
          <Button variant="danger" isLoading={isEmergencyStopping} onClick={async () => {
             setIsEmergencyStopping(true);
             try {
                const success = await emergencyStop();
                if (success) {
                  addToast({ type: 'success', title: 'Emergency Stop Executed', description: 'All jobs have been wiped.' });
                }
             } catch (error: any) {
                addToast({ type: 'error', title: 'Action Failed', description: error.message || 'Emergency stop failed.' });
             } finally {
                setIsEmergencyStopping(false);
                closeModal();
             }
          }}>OBLITERATE QUEUE</Button>
        </>
      )
    });
  };

  if (!metrics) return <LoadingScreen message="Linking to hardware layer..." />;

  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-desc">System telemetry and high-level metrics</p>
        </div>
        
        <div>
          <Button 
            variant="danger"
            onClick={handleEmergencyStopClick}
            disabled={isEmergencyStopping}
          >
            <AlertOctagon size={16} style={{ marginRight: '0.5rem' }} /> EMERGENCY STOP ALL
          </Button>
        </div>
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
               <HealthMeter label="Memory Used" value={metrics.memoryUsed && metrics.memoryTotal ? Math.round((metrics.memoryUsed / metrics.memoryTotal) * 100) : 0} />
               <HealthMeter label="Disk Usage" value={metrics.diskPercent ?? 0} />
               <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--border-default)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Uptime</span>
                  <span className="data-mono">{formatUptime(liveUptime)}</span>
               </div>
            </div>
         </div>
         
         <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Resource Usage History</h3>
            <div style={{ flex: 1, width: '100%', minHeight: '200px' }}>
              {metricsHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metricsHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8A2BE2" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8A2BE2" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EA3943" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#EA3943" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatTime} 
                      stroke="var(--text-muted)" 
                      fontSize={11} 
                      tickMargin={10} 
                    />
                    <YAxis 
                      stroke="var(--text-muted)" 
                      fontSize={11} 
                      domain={[0, 100]} 
                      tickFormatter={(val) => `${val}%`} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-surface-alt)', border: '1px solid var(--border-default)', borderRadius: '4px' }} 
                      labelFormatter={formatTime}
                    />
                    <Area type="monotone" dataKey="cpu" stroke="#00E5FF" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                    <Area type="monotone" dataKey="memory" stroke="#8A2BE2" fillOpacity={1} fill="url(#colorMem)" name="Memory %" />
                    <Area type="monotone" dataKey="disk" stroke="#EA3943" fillOpacity={1} fill="url(#colorDisk)" name="Disk %" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  Awaiting telemetry...
                </div>
              )}
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
