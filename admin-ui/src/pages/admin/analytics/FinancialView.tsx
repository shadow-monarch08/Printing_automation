import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { LoadingNet } from '../../../components/shared/LoadingNet';
import { IndianRupee, Layers, CheckCircle2, Calculator } from 'lucide-react';

interface FinancialViewProps {
  startDate: string;
  endDate: string;
}

export const FinancialView: React.FC<FinancialViewProps> = ({ startDate, endDate }) => {
  const [summary, setSummary] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [colorSplit, setColorSplit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [sumRes, trendRes, colorRes] = await Promise.all([
          api.fetchFinancialSummary(startDate, endDate),
          api.fetchRevenueTrend(startDate, endDate),
          api.fetchColorSplit(startDate, endDate)
        ]);
        setSummary(sumRes);
        setTrend(trendRes);
        setColorSplit(colorRes);
      } catch (err) {
        console.error("Failed to fetch financial data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate]);

  if (loading) return (
    <div style={{ padding: '4rem 0' }}>
      <LoadingNet message="Loading financial data..." />
    </div>
  );

  const colorData = colorSplit ? [
    { name: 'Color', revenue: colorSplit.colorRevenue, jobs: colorSplit.colorJobs },
    { name: 'Grayscale', revenue: colorSplit.bwRevenue, jobs: colorSplit.bwJobs }
  ] : [];

  return (
    <div className="financial-view">
      <div className="analytics-summary-cards dashboard-metrics" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="card" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Revenue</span>
            <IndianRupee size={18} />
          </div>
          <div className="data-mono metric-value" style={{ color: 'var(--text-primary)' }}>
            ₹{summary?.totalRevenue || 0}
          </div>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Jobs</span>
            <Layers size={18} />
          </div>
          <div className="data-mono metric-value" style={{ color: 'var(--text-primary)' }}>
            {summary?.totalJobs || 0}
          </div>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed Jobs</span>
            <CheckCircle2 size={18} />
          </div>
          <div className="data-mono metric-value" style={{ color: 'var(--text-primary)' }}>
            {summary?.completedJobs || 0}
          </div>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Cost / Job</span>
            <Calculator size={18} />
          </div>
          <div className="data-mono metric-value" style={{ color: 'var(--text-primary)' }}>
            ₹{summary?.avgCostPerJob ? summary.avgCostPerJob.toFixed(2) : '0.00'}
          </div>
        </div>
      </div>

      <div className="analytics-charts">
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Revenue Trend</h3>
          <div style={{ height: 300, marginLeft: '-15px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007bff" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#007bff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" />
                <YAxis />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#007bff" fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Color vs B&W Split</h3>
          <div style={{ height: 300, marginLeft: '-15px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={colorData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#8884d8" name="Revenue (₹)" />
                <Bar dataKey="jobs" fill="#82ca9d" name="Jobs" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Color: ₹{colorSplit?.colorRevenue || 0} ({colorSplit?.colorJobs || 0} jobs) · B&W: ₹{colorSplit?.bwRevenue || 0} ({colorSplit?.bwJobs || 0} jobs)
          </div>
        </div>
      </div>
    </div>
  );
};
