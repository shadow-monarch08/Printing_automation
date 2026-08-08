import { useEffect, useState } from 'react';
import { useAdminStore } from '../../stores/useAdminStore';
import { useModal } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { X, Pause, Play, ArrowUpFromLine, AlertOctagon } from 'lucide-react';
import { LoadingNet } from '../../components/shared/LoadingNet';
import { Button } from '../../components/shared/Button';
import { PaperTable } from '../../components/shared/PaperTable';
import { EmptyState } from '../../components/shared/EmptyState';

export function Queue() {
  const { 
    queue, isLoadingQueue, isQueuePaused, 
    loadQueue, checkQueueStatus, 
    cancelJob, pauseJob, resumeJob, prioritizeJob,
    pauseGlobalQueue, resumeGlobalQueue, emergencyStop
  } = useAdminStore();
  
  const { openModal, closeModal } = useModal();
  const { addToast } = useToast();
  const [processingAction, setProcessingAction] = useState<{id: string, type: 'cancel' | 'pause' | 'resume' | 'prioritize' | 'emergency' | 'toggleQueue'} | null>(null);

  useEffect(() => {
    loadQueue();
    checkQueueStatus();
  }, [loadQueue, checkQueueStatus]);

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
                }
             } catch (error: any) {
                /* Handled by global API error interceptor */
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
          /* Handled by global API error interceptor */
      } finally {
          setProcessingAction(null);
      }
  };

  const handleResume = async (id: string) => {
      setProcessingAction({ id, type: 'resume' });
      try {
          await resumeJob(id);
          addToast({ type: 'success', title: 'Job Resumed', description: `${id.substring(0, 8)} is now resuming.` });
      } catch (error: any) {
          /* Handled by global API error interceptor */
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
          }
      } catch (error: any) {
          /* Handled by global API error interceptor */
      } finally {
          setProcessingAction(null);
      }
  };

  const handleToggleQueue = async () => {
    setProcessingAction({ id: 'global', type: 'toggleQueue' });
    try {
      if (isQueuePaused) {
        await resumeGlobalQueue();
        addToast({ type: 'success', title: 'Queue Resumed', description: 'Now accepting and processing jobs.' });
      } else {
        await pauseGlobalQueue();
        addToast({ type: 'info', title: 'Queue Paused', description: 'Master queue suspended. Active jobs will finish.' });
      }
    } catch (error: any) {
      /* Handled by global API error interceptor */
    } finally {
      setProcessingAction(null);
    }
  };

  const handleEmergencyStopClick = () => {
    openModal({
      title: 'EMERGENCY STOP',
      content: (
        <div>
          <p style={{ color: 'var(--status-error)', fontWeight: 600, marginBottom: '1rem' }}>
            Are you sure? This will obliterate ALL jobs.
          </p>
          <p>
            This action will completely wipe the BullMQ queue and cancel all active print jobs at the operating system level (CUPS). Users will not be refunded automatically.
          </p>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" onClick={closeModal}>Abort</Button>
          <Button variant="danger" isLoading={processingAction?.type === 'emergency'} onClick={async () => {
             setProcessingAction({ id: 'global', type: 'emergency' });
             try {
                const success = await emergencyStop();
                if (success) {
                  addToast({ type: 'success', title: 'Emergency Stop Executed', description: 'All jobs have been wiped.' });
                }
             } catch (error: any) {
                /* Handled by global API error interceptor */
             } finally {
                setProcessingAction(null);
                closeModal();
             }
          }}>OBLITERATE QUEUE</Button>
        </>
      )
    });
  };

  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Master Queue</h1>
          <p className="page-desc">Global print job traffic control</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button 
            variant={isQueuePaused ? "primary" : "ghost"}
            isLoading={processingAction?.type === 'toggleQueue'}
            onClick={handleToggleQueue}
          >
            {isQueuePaused ? (
              <><Play size={16} style={{ marginRight: '0.5rem' }} /> Resume Queue</>
            ) : (
              <><Pause size={16} style={{ marginRight: '0.5rem' }} /> Pause Queue</>
            )}
          </Button>

          <Button 
            variant="danger"
            onClick={handleEmergencyStopClick}
            disabled={processingAction?.type === 'emergency'}
          >
            <AlertOctagon size={16} style={{ marginRight: '0.5rem' }} /> EMERGENCY STOP ALL
          </Button>
        </div>
      </header>

      <PaperTable className="queue-table-wrap" style={{ padding: 0 }}>
        {isQueuePaused && (
          <div style={{ padding: '1rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--status-warning)', borderBottom: '1px solid var(--border-default)', textAlign: 'center', fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            <Pause size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />
            MASTER QUEUE PAUSED - NEW JOBS ARE ON HOLD
          </div>
        )}
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
              <tr className="loading-row">
                <td colSpan={6} style={{ padding: '3rem 0' }}>
                  <LoadingNet message="Synchronizing print queue..." />
                </td>
              </tr>
            ) : queue.map(job => (
              <tr key={job.id}>
                <td className="data-mono" title={job.id} data-label="Job ID">{job.id.substring(0, 8)}...</td>
                <td className="filename-cell" data-label="Document">{job.filename}</td>
                <td data-label="Owner">{job.owner}</td>
                <td data-label="Status">
                  <span className={`badge badge-${job.status}`}>
                    {job.status}
                  </span>
                </td>
                <td className="target-printer-cell" data-label="Hardware Target">{job.targetPrinter}</td>
                <td className="actions-cell" data-label="Actions">
                   <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <Button 
                         variant="ghost" 
                         className="btn-action-mobile"
                         style={{ padding: '0.4rem', minWidth: '36px' }} 
                         onClick={() => handlePrioritize(job.id)}
                         title="Prioritize"
                         disabled={job.status !== 'queued' && job.status !== 'spooling'}
                         isLoading={processingAction?.id === job.id && processingAction.type === 'prioritize'}
                      >
                         <ArrowUpFromLine size={16} />
                      </Button>
                      
                      {job.status === 'paused' ? (
                        <Button 
                           variant="ghost" 
                           className="btn-action-mobile"
                           style={{ padding: '0.4rem', minWidth: '36px' }} 
                           onClick={() => handleResume(job.id)}
                           title="Resume"
                           isLoading={processingAction?.id === job.id && processingAction.type === 'resume'}
                        >
                           <Play size={16} />
                        </Button>
                      ) : (
                        <Button 
                           variant="ghost" 
                           className="btn-action-mobile"
                           style={{ padding: '0.4rem', minWidth: '36px' }} 
                           onClick={() => handlePause(job.id)}
                           title="Pause"
                           disabled={job.status === 'done' || job.status === 'failed'}
                           isLoading={processingAction?.id === job.id && processingAction.type === 'pause'}
                        >
                           <Pause size={16} />
                        </Button>
                      )}

                      <Button 
                         variant="ghost" 
                         className="btn-action-mobile"
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
              <tr className="empty-row">
                <td colSpan={6} style={{ padding: '1rem' }}>
                  <EmptyState title="Queue Empty" description="There are no active or pending print jobs in the master queue." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PaperTable>
    </div>
  );
}
