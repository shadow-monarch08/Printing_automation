import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

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

  if (loading) return <div>Loading financial data...</div>;

  const colorData = colorSplit ? [
    { name: 'Color', revenue: colorSplit.colorRevenue, jobs: colorSplit.colorJobs },
    { name: 'Grayscale', revenue: colorSplit.bwRevenue, jobs: colorSplit.bwJobs }
  ] : [];

  return (
    <div className="financial-view">
      <div className="analytics-summary-cards">
        <div className="card">
          <div className="card-title">Total Revenue</div>
          <div className="card-value">₹{summary?.totalRevenue || 0}</div>
        </div>
        <div className="card">
          <div className="card-title">Total Jobs</div>
          <div className="card-value">{summary?.totalJobs || 0}</div>
        </div>
        <div className="card">
          <div className="card-title">Completed Jobs</div>
          <div className="card-value">{summary?.completedJobs || 0}</div>
        </div>
        <div className="card">
          <div className="card-title">Avg Cost / Job</div>
          <div className="card-value">₹{summary?.avgCostPerJob ? summary.avgCostPerJob.toFixed(2) : '0.00'}</div>
        </div>
      </div>

      <div className="analytics-charts">
        <div className="analytics-chart-card">
          <div className="analytics-chart-title">Revenue Trend</div>
          <div style={{ height: 300 }}>
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

        <div className="analytics-chart-card">
          <div className="analytics-chart-title">Color vs B&W Split</div>
          <div style={{ height: 300 }}>
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
