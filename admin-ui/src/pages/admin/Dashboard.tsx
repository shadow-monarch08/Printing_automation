import { useEffect, useState } from 'react';
import { useAdminStore } from '../../stores/useAdminStore';
import { Activity, Printer, Layers, DollarSign, AlertOctagon } from 'lucide-react';
import { useModal } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/shared/Button';
import { MetricCard } from '../../components/admin/MetricCard';
import { HealthMeter } from '../../components/admin/HealthMeter';
import { ChartTooltip } from '../../components/admin/charts/ChartTooltip';
import { DashboardSkeleton } from '../../components/admin/skeletons/DashboardSkeleton';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard() {
  const { metrics, metricsHistory, loadMetrics, loadMetricsHistory, emergencyStop } = useAdminStore();
  const [liveUptime, setLiveUptime] = useState<number>(0);
  const { openModal, closeModal } = useModal();
  const { addToast } = useToast();
  const [isEmergencyStopping, setIsEmergencyStopping] = useState(false);

  useEffect(() => {
    loadMetrics();
    loadMetricsHistory();
    const metricsInterval = setInterval(() => {
      loadMetrics();
      loadMetricsHistory();
    }, 25000);
    return () => clearInterval(metricsInterval);
  }, [loadMetrics, loadMetricsHistory]);

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

  const formatTime = (isoString: any) => {
    if (typeof isoString !== 'string') return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
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

  if (!metrics) return <DashboardSkeleton />;

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
        <MetricCard label="Active Printers" value={`${metrics.activePrinters ?? '?'} / ${metrics.totalPrinters ?? '?'}`} icon={<Printer size={18} />} gaugeId="[GAUGE_DEV_LIST]" />
        <MetricCard label="Queued Jobs" value={metrics.waiting + metrics.active} icon={<Layers size={18} />} alert={metrics.waiting + metrics.active > 10} gaugeId="[GAUGE_QUEUE_VOL]" />
        <MetricCard label="Jobs Today" value={metrics.totalJobsToday ?? (metrics.completed + metrics.failed)} icon={<Activity size={18} />} gaugeId="[GAUGE_JOB_ACCUM]" />
        <MetricCard label="Gross Revenue" value={`₹${metrics.revenue ?? '0.00'}`} icon={<DollarSign size={18} />} gaugeId="[GAUGE_REV_GROSS]" />
      </div>

      <div className="dashboard-detail-grid">
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>System Health</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <HealthMeter label="CPU Load" value={metrics.cpuLoad ?? 0} meterId="[PROC_CPU]" />
            <HealthMeter label="Memory Used" value={metrics.memoryUsed && metrics.memoryTotal ? Math.round((metrics.memoryUsed / metrics.memoryTotal) * 100) : 0} meterId="[RAM_USAGE]" />
            <HealthMeter label="Disk Usage" value={metrics.diskPercent ?? 0} meterId="[STORAGE_VOL]" />
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--border-default)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>UPTIME [SYS_UPTIME]</span>
              <span className="data-mono" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatUptime(liveUptime)}</span>
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
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-secondary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-secondary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--status-error)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--status-error)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--border-default)" vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTime}
                    stroke="var(--text-secondary)"
                    fontFamily="var(--font-mono)"
                    fontSize={11}
                    tickMargin={10}
                  />
                  <YAxis
                    stroke="var(--text-secondary)"
                    fontFamily="var(--font-mono)"
                    fontSize={11}
                    domain={[0, 100]}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip content={<ChartTooltip labelFormatter={formatTime} />} />
                  <Area type="monotone" dataKey="cpu" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                  <Area type="monotone" dataKey="memory" stroke="var(--accent-secondary)" strokeWidth={2} fillOpacity={1} fill="url(#colorMem)" name="Memory %" />
                  <Area type="monotone" dataKey="disk" stroke="var(--status-error)" strokeWidth={2} fillOpacity={1} fill="url(#colorDisk)" name="Disk %" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-muted)' }}>
                Awaiting telemetry...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
