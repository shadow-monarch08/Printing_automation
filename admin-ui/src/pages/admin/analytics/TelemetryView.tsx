import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

  if (loading) return <div>Loading telemetry data...</div>;

  const volumeLeaderboard = [...telemetry].sort((a, b) => b.totalPages - a.totalPages);

  return (
    <div className="telemetry-view">
      <div className="analytics-charts" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="analytics-chart-card">
          <div className="analytics-chart-title">Volume Leaderboard (Pages)</div>
          <div style={{ height: 300 }}>
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

        <div className="analytics-chart-card">
          <div className="analytics-chart-title">Job Error Rates</div>
          <div style={{ height: 300 }}>
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
          <div className="card" key={t.printer}>
            <div className="card-title" style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 8 }}>{t.printer}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Total Pages: <strong style={{color: 'var(--text-primary)'}}>{t.totalPages}</strong></div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Completed: <strong style={{color: 'var(--success-color)'}}>{t.completedJobs}</strong></div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Failed: <strong style={{color: 'var(--error-color)'}}>{t.failedJobs}</strong></div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Error Rate: <strong>{t.errorRate.toFixed(1)}%</strong></div>
          </div>
        ))}
        {telemetry.length === 0 && <div className="text-secondary">No telemetry data for this period.</div>}
      </div>
    </div>
  );
};
