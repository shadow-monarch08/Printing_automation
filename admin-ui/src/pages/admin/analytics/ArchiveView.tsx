import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import dayjs from 'dayjs';
import { Download } from 'lucide-react';
import { CustomSelect } from '../../../components/shared/CustomSelect';

interface ArchiveViewProps {
  startDate: string;
  endDate: string;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({ startDate, endDate }) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [printerFilter, setPrinterFilter] = useState('');
  const [printers, setPrinters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Reset page when filters change
    setPage(1);
  }, [startDate, endDate, statusFilter, printerFilter, limit]);

  useEffect(() => {
    const fetchArchive = async () => {
      setLoading(true);
      try {
        const res = await api.fetchJobArchive({ startDate, endDate, status: statusFilter, printer: printerFilter, page, limit });
        setJobs(res.jobs);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        
        const pList = await api.fetchPrinters();
        setPrinters(pList.map(p => p.name));
      } catch (err) {
        console.error("Failed to fetch archive", err);
      } finally {
        setLoading(false);
      }
    };
    fetchArchive();
  }, [startDate, endDate, statusFilter, printerFilter, page, limit]);

  const handleExport = () => {
    const url = api.exportJobsCSV(startDate, endDate, statusFilter, printerFilter);
    window.open(url, '_blank');
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'queued', label: 'Queued' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const printerOptions = [
    { value: '', label: 'All Printers' },
    ...printers.map(p => ({ value: p, label: p }))
  ];

  const limitOptions = [
    { value: '10', label: '10 per page' },
    { value: '25', label: '25 per page' },
    { value: '50', label: '50 per page' }
  ];

  return (
    <div className="archive-view">
      <div className="analytics-filter-bar">
        <CustomSelect
          options={statusOptions}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <CustomSelect
          options={printerOptions}
          value={printerFilter}
          onChange={setPrinterFilter}
        />
        <CustomSelect
          options={limitOptions}
          value={limit.toString()}
          onChange={val => setLimit(parseInt(val, 10))}
        />
        <button className="btn btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div style={{ marginBottom: 'var(--spacing-md)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        Showing {(page - 1) * limit + (total > 0 ? 1 : 0)}–{Math.min(page * limit, total)} of {total} records
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Job ID</th>
              <th>File</th>
              <th>Settings</th>
              <th>Cost</th>
              <th>Status</th>
              <th>Printer</th>
              <th>Submitted</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>No jobs found for the selected criteria.</td></tr>
            ) : (
              jobs.map(job => (
                <tr key={job.id}>
                  <td title={job.id}>{job.id.substring(0, 8)}...</td>
                  <td title={job.filename} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.filename}</td>
                  <td>{job.pages}p × {job.copies} ({job.color_mode}, {job.duplex})</td>
                  <td>₹{job.cost}</td>
                  <td>
                    <span className={`status-badge ${job.status}`}>
                      {job.status}
                    </span>
                  </td>
                  <td>{job.executed_by_printer || '-'}</td>
                  <td>{dayjs(job.submitted_at).format('MMM D, HH:mm')}</td>
                  <td>{job.completed_at ? dayjs(job.completed_at).format('MMM D, HH:mm') : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="analytics-pagination">
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
};
