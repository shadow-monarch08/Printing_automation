import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import dayjs from 'dayjs';
import { Download } from 'lucide-react';
import { CustomSelect } from '../../../components/shared/CustomSelect';
import { Button } from '../../../components/shared/Button';
import { LoadingNet } from '../../../components/shared/LoadingNet';
import { PaperTable } from '../../../components/shared/PaperTable';
import { EmptyState } from '../../../components/shared/EmptyState';

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
        <Button variant="ghost" onClick={handleExport} leftIcon={<Download size={16} />}>
          Export CSV
        </Button>
      </div>

      <PaperTable
        style={{ padding: 0 }}
        page={page}
        totalPages={totalPages}
        totalRecords={total}
        itemsPerPage={limit}
        onPageChange={setPage}
      >
        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
          <table className="table" style={{ minWidth: '650px' }}>
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
                <tr className="loading-row"><td colSpan={8} style={{ padding: '3rem 0' }}><LoadingNet message="Loading archive..." /></td></tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '1rem' }}>
                    <EmptyState title="No Records Found" description="No jobs matched the selected filter criteria." />
                  </td>
                </tr>
              ) : (
                jobs.map(job => (
                  <tr key={job.id}>
                    <td className="data-mono" title={job.id}>{job.id.substring(0, 8)}...</td>
                    <td title={job.filename} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.filename}</td>
                    <td>{job.pages}p × {job.copies} ({job.color_mode}, {job.duplex})</td>
                    <td className="data-mono">₹{job.cost}</td>
                    <td>
                      <span className={`badge badge-${job.status}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="target-printer-cell">{job.executed_by_printer || '-'}</td>
                    <td className="data-mono">{dayjs(job.submitted_at).format('MMM D, HH:mm')}</td>
                    <td className="data-mono">{job.completed_at ? dayjs(job.completed_at).format('MMM D, HH:mm') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PaperTable>
    </div>
  );
};
