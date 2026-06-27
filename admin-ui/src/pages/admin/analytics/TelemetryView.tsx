import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LoadingNet } from '../../../components/shared/LoadingNet';

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
    <div style={{ padding: '4rem 0' }}>
      <LoadingNet message="Loading telemetry data..." />
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
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" />
                <YAxis dataKey="printer" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="totalPages" fill="#8884d8" name="Total Pages" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Job Error Rates</h3>
          <div style={{ height: 300, marginLeft: '-15px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={telemetry} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="printer" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completedJobs" stackId="a" fill="#82ca9d" name="Completed" />
                <Bar dataKey="failedJobs" stackId="a" fill="#ff4d4f" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="analytics-summary-cards">
        {telemetry.map(t => (
          <div className="card" key={t.printer} style={{ borderLeft: '3px solid var(--accent-primary)' }}>
            <h3 style={{ marginBottom: '1rem' }}>{t.printer}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Pages</span>
                <span className="data-mono">{t.totalPages}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Completed</span>
                <span className="data-mono" style={{ color: 'var(--success-color, #28a745)' }}>{t.completedJobs}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Failed</span>
                <span className="data-mono" style={{ color: 'var(--error-color, #dc3545)' }}>{t.failedJobs}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderTop: '1px solid var(--border-default)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Error Rate</span>
                <span className="data-mono">{t.errorRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
        {telemetry.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No telemetry data available for this period.
          </div>
        )}
      </div>
    </div>
  );
};
