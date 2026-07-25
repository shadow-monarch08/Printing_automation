import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { LoadingNet } from '../../../components/shared/LoadingNet';
import { MetricCard } from '../../../components/admin/MetricCard';
import { ChartTooltip } from '../../../components/admin/charts/ChartTooltip';
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
    <div className="financial-view" style={{ minHeight: '500px' }}>
      <div className="analytics-summary-cards dashboard-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: 'var(--spacing-lg)' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ padding: '16px 20px', borderLeft: '3px solid var(--border-default)' }}>
            <div className="skeleton-box relative overflow-hidden" style={{ width: '100px', height: '14px', marginBottom: '12px', backgroundColor: 'var(--bg-surface-alt)' }} />
            <div className="skeleton-box relative overflow-hidden" style={{ width: '120px', height: '32px', backgroundColor: 'var(--bg-surface-alt)' }} />
          </div>
        ))}
      </div>
      <div className="analytics-charts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card" style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingNet message="Loading financial trend..." />
        </div>
        <div className="card" style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingNet message="Loading color split..." />
        </div>
      </div>
    </div>
  );

  const colorData = colorSplit ? [
    { name: 'Color', revenue: colorSplit.colorRevenue, jobs: colorSplit.colorJobs },
    { name: 'Grayscale', revenue: colorSplit.bwRevenue, jobs: colorSplit.bwJobs }
  ] : [];

  return (
    <div className="financial-view">
      <div className="analytics-summary-cards dashboard-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: 'var(--spacing-lg)' }}>
        <MetricCard label="Total Revenue" value={`₹${summary?.totalRevenue || 0}`} icon={<IndianRupee size={18} />} gaugeId="[REV_TOTAL]" />
        <MetricCard label="Total Jobs" value={summary?.totalJobs || 0} icon={<Layers size={18} />} gaugeId="[JOB_TOTAL]" />
        <MetricCard label="Completed Jobs" value={summary?.completedJobs || 0} icon={<CheckCircle2 size={18} />} gaugeId="[JOB_COMPLETED]" />
        <MetricCard label="Avg Cost / Job" value={`₹${summary?.avgCostPerJob ? summary.avgCostPerJob.toFixed(2) : '0.00'}`} icon={<Calculator size={18} />} gaugeId="[COST_AVG]" />
      </div>

      <div className="analytics-charts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Revenue Trend</h3>
          <div style={{ height: 300, marginLeft: '-15px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--text-secondary)" fontFamily="var(--font-mono)" fontSize={11} />
                <YAxis stroke="var(--text-secondary)" fontFamily="var(--font-mono)" fontSize={11} />
                <CartesianGrid strokeDasharray="2 2" stroke="var(--border-default)" vertical={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" name="Revenue (₹)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Color vs B&W Split</h3>
          <div style={{ height: 300, marginLeft: '-15px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={colorData}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--border-default)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontFamily="var(--font-mono)" fontSize={11} />
                <YAxis stroke="var(--text-secondary)" fontFamily="var(--font-mono)" fontSize={11} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="revenue" fill="var(--accent-primary)" name="Revenue (₹)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="jobs" fill="var(--accent-secondary)" name="Jobs" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Color: ₹{colorSplit?.colorRevenue || 0} ({colorSplit?.colorJobs || 0} jobs) · B&W: ₹{colorSplit?.bwRevenue || 0} ({colorSplit?.bwJobs || 0} jobs)
          </div>
        </div>
      </div>
    </div>
  );
};
