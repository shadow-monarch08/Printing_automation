// src/pages/admin/Queue.tsx
import { useEffect } from 'react';
import { useAdminStore } from '../../stores/useAdminStore';
import { useModal } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { X, Pause, ArrowUpFromLine } from 'lucide-react';

export function Queue() {
  const { queue, loadQueue, cancelJob, pauseJob, prioritizeJob } = useAdminStore();
  const { openModal, closeModal } = useModal();
  const { addToast } = useToast();

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleCancelClick = (id: string) => {
    openModal({
      title: 'Confirm Annihilation',
      content: <p>Are you sure you want to permanently delete job <span className="data-mono" title={id}>{id.substring(0, 8)}...</span> from the master queue?</p>,
      footer: (
        <>
          <button className="btn-ghost" onClick={closeModal}>Abort</button>
          <button className="btn-danger" onClick={async () => {
             const success = await cancelJob(id);
             closeModal();
             if (success) {
               addToast({ type: 'success', title: 'Job Annihilated', description: `${id.substring(0, 8)} removed.` });
             }
          }}>Execute Delete</button>
        </>
      )
    });
  };

  const handlePause = async (id: string) => {
      await pauseJob(id);
      addToast({ type: 'info', title: 'Job Paused', description: `${id.substring(0, 8)} has been suspended.` });
  };

  const handlePrioritize = async (id: string) => {
      const success = await prioritizeJob(id);
      if (success) {
          addToast({ type: 'success', title: 'Route Override', description: `${id.substring(0, 8)} moved to front of queue.` });
      }
  };

  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Master Queue</h1>
        <p className="page-desc">Global print job traffic control</p>
      </header>

      <div className="card table-wrapper queue-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>Job ID</th>
              <th>Document</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Hardware Target</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.map(job => (
              <tr key={job.id}>
                <td className="data-mono" title={job.id}>{job.id.substring(0, 8)}...</td>
                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.filename}</td>
                <td>{job.owner}</td>
                <td>
                  <span className={`badge badge-${job.status}`}>
                    {job.status}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{job.targetPrinter}</td>
                <td style={{ textAlign: 'right' }}>
                   <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button 
                         className="btn-ghost" 
                         style={{ padding: '0.4rem' }} 
                         onClick={() => handlePrioritize(job.id)}
                         title="Prioritize"
                         disabled={job.status !== 'queued' && job.status !== 'spooling'}
                      >
                         <ArrowUpFromLine size={16} />
                      </button>
                      <button 
                         className="btn-ghost" 
                         style={{ padding: '0.4rem' }} 
                         onClick={() => handlePause(job.id)}
                         title="Pause"
                         disabled={job.status === 'done' || job.status === 'failed'}
                      >
                         <Pause size={16} />
                      </button>
                      <button 
                         className="btn-ghost" 
                         style={{ padding: '0.4rem', color: 'var(--status-error)' }} 
                         onClick={() => handleCancelClick(job.id)}
                         title="Cancel"
                      >
                         <X size={16} />
                      </button>
                   </div>
                </td>
              </tr>
            ))}
            {queue.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Queue is completely empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
