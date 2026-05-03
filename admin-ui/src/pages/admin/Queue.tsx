// src/pages/admin/Queue.tsx
import { useEffect } from 'react';
import { useAdminStore } from '../../stores/useAdminStore';
import { useModal } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { X, Pause, ArrowUpFromLine } from 'lucide-react';
import { LoadingNet } from '../../components/shared/LoadingNet';
import { Button } from '../../components/shared/Button';
import { useState } from 'react';

export function Queue() {
  const { queue, isLoadingQueue, loadQueue, cancelJob, pauseJob, prioritizeJob } = useAdminStore();
  const { openModal, closeModal } = useModal();
  const { addToast } = useToast();
  const [processingAction, setProcessingAction] = useState<{id: string, type: 'cancel' | 'pause' | 'prioritize'} | null>(null);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleCancelClick = (id: string) => {
    openModal({
      title: 'Confirm Annihilation',
      content: <p>Are you sure you want to permanently delete job <span className="data-mono" title={id}>{id.substring(0, 8)}...</span> from the master queue?</p>,
      footer: (
        <>
          <Button variant="ghost" onClick={closeModal}>Abort</Button>
          <Button variant="danger" isLoading={processingAction?.id === id && processingAction.type === 'cancel'} onClick={async () => {
             setProcessingAction({ id, type: 'cancel' });
             try {
                const success = await cancelJob(id);
                if (success) {
                  addToast({ type: 'success', title: 'Job Annihilated', description: `${id.substring(0, 8)} removed.` });
                } else {
                  addToast({ type: 'error', title: 'Action Failed', description: `Could not cancel job ${id.substring(0, 8)}.` });
                }
             } catch (error: any) {
                addToast({ type: 'error', title: 'Action Failed', description: error.message || 'Unknown error occurred.' });
             } finally {
                setProcessingAction(null);
                closeModal();
             }
          }}>Execute Delete</Button>
        </>
      )
    });
  };

  const handlePause = async (id: string) => {
      setProcessingAction({ id, type: 'pause' });
      try {
          await pauseJob(id);
          addToast({ type: 'info', title: 'Job Paused', description: `${id.substring(0, 8)} has been suspended.` });
      } catch (error: any) {
          addToast({ type: 'error', title: 'Action Failed', description: error.message || 'Unknown error occurred.' });
      } finally {
          setProcessingAction(null);
      }
  };

  const handlePrioritize = async (id: string) => {
      setProcessingAction({ id, type: 'prioritize' });
      try {
          const success = await prioritizeJob(id);
          if (success) {
              addToast({ type: 'success', title: 'Route Override', description: `${id.substring(0, 8)} moved to front of queue.` });
          } else {
              addToast({ type: 'error', title: 'Action Failed', description: `Could not prioritize job ${id.substring(0, 8)}.` });
          }
      } catch (error: any) {
          addToast({ type: 'error', title: 'Action Failed', description: error.message || 'Unknown error occurred.' });
      } finally {
          setProcessingAction(null);
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
            {isLoadingQueue ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem 0' }}>
                  <LoadingNet message="Synchronizing print queue..." />
                </td>
              </tr>
            ) : queue.map(job => (
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
                      <Button 
                         variant="ghost" 
                         style={{ padding: '0.4rem', minWidth: '36px' }} 
                         onClick={() => handlePrioritize(job.id)}
                         title="Prioritize"
                         disabled={job.status !== 'queued' && job.status !== 'spooling'}
                         isLoading={processingAction?.id === job.id && processingAction.type === 'prioritize'}
                      >
                         <ArrowUpFromLine size={16} />
                      </Button>
                      <Button 
                         variant="ghost" 
                         style={{ padding: '0.4rem', minWidth: '36px' }} 
                         onClick={() => handlePause(job.id)}
                         title="Pause"
                         disabled={job.status === 'done' || job.status === 'failed'}
                         isLoading={processingAction?.id === job.id && processingAction.type === 'pause'}
                      >
                         <Pause size={16} />
                      </Button>
                      <Button 
                         variant="ghost" 
                         style={{ padding: '0.4rem', color: 'var(--status-error)', minWidth: '36px' }} 
                         onClick={() => handleCancelClick(job.id)}
                         title="Cancel"
                      >
                         <X size={16} />
                      </Button>
                   </div>
                </td>
              </tr>
            ))}
            {!isLoadingQueue && queue.length === 0 && (
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
