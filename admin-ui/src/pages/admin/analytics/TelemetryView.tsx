import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LoadingNet } from '../../../components/shared/LoadingNet';
import { ChartTooltip } from '../../../components/admin/charts/ChartTooltip';

interface TelemetryViewProps {
  startDate: string;
  endDate: string;
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({ startDate, endDate }) => {
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await api.fetchFleetTelemetry(startDate, endDate);
        setTelemetry(data);
      } catch (err) {
        console.error("Failed to fetch telemetry", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate]);

  if (loading) return (
    <div className="telemetry-view" style={{ minHeight: '500px' }}>
      <div className="analytics-charts" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="card" style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingNet message="Loading volume leaderboard..." />
        </div>
        <div className="card" style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingNet message="Loading job error rates..." />
        </div>
      </div>
    </div>
  );

  const volumeLeaderboard = [...telemetry].sort((a, b) => b.totalPages - a.totalPages);

  return (
    <div className="telemetry-view">
      <div className="analytics-charts" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Volume Leaderboard (Pages)</h3>
          <div style={{ height: 300, marginLeft: '-15px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeLeaderboard} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--border-default)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="var(--text-secondary)" fontFamily="var(--font-mono)" fontSize={11} />
                <YAxis dataKey="printer" type="category" width={100} stroke="var(--text-secondary)" fontFamily="var(--font-mono)" fontSize={11} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="totalPages" fill="var(--accent-primary)" name="Total Pages" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Job Error Rates</h3>
          <div style={{ height: 300, marginLeft: '-15px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={telemetry} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--border-default)" vertical={false} />
                <XAxis dataKey="printer" stroke="var(--text-secondary)" fontFamily="var(--font-mono)" fontSize={11} />
                <YAxis stroke="var(--text-secondary)" fontFamily="var(--font-mono)" fontSize={11} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="completedJobs" stackId="a" fill="var(--accent-secondary)" name="Completed" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failedJobs" stackId="a" fill="var(--status-error)" name="Failed" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="analytics-summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {telemetry.map(t => (
          <div className="card" key={t.printer} style={{ borderLeft: '3px solid var(--accent-primary)', padding: '20px' }}>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px dashed var(--border-default)', paddingBottom: '8px' }}>
              {t.printer}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>Total Pages</span>
                <span className="data-mono" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{t.totalPages}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>Completed</span>
                <span className="data-mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-secondary)', fontWeight: 700 }}>{t.completedJobs}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>Failed</span>
                <span className="data-mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-error)', fontWeight: 700 }}>{t.failedJobs}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderTop: '1px solid var(--border-default)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>Error Rate</span>
                <span className="data-mono" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: t.errorRate > 10 ? 'var(--status-error)' : 'var(--text-primary)' }}>{t.errorRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
        {telemetry.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
            No telemetry data available for this period.
          </div>
        )}
      </div>
    </div>
  );
};
