import React, { useState } from 'react';
import dayjs from 'dayjs';
import { DateRangePicker } from '../../components/shared/DateRangePicker';
import { FinancialView } from './analytics/FinancialView';
import { TelemetryView } from './analytics/TelemetryView';
import { ArchiveView } from './analytics/ArchiveView';
import '../../styles/analytics.css';

type TabType = 'financial' | 'telemetry' | 'archive';

export const Analytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('financial');
  const [startDate, setStartDate] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h1 className="text-2xl font-bold" style={{ margin: 0 }}>Analytics & Reporting</h1>
        <DateRangePicker 
          startDate={startDate} 
          endDate={endDate} 
          onChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }} 
        />
      </div>

      <div className="analytics-tabs">
        <button 
          className={`analytics-tab ${activeTab === 'financial' ? 'active' : ''}`}
          onClick={() => setActiveTab('financial')}
        >
          Financial Ledger
        </button>
        <button 
          className={`analytics-tab ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          Fleet Telemetry
        </button>
        <button 
          className={`analytics-tab ${activeTab === 'archive' ? 'active' : ''}`}
          onClick={() => setActiveTab('archive')}
        >
          Job Archive
        </button>
      </div>

      <div className="analytics-content">
        {activeTab === 'financial' && <FinancialView startDate={startDate} endDate={endDate} />}
        {activeTab === 'telemetry' && <TelemetryView startDate={startDate} endDate={endDate} />}
        {activeTab === 'archive' && <ArchiveView startDate={startDate} endDate={endDate} />}
      </div>
    </div>
  );
};
