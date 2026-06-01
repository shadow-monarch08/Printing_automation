import { useEffect } from 'react';
import { useAdminStore } from '../../stores/useAdminStore';
import { useToast } from '../../context/ToastContext';
import { Printer, Search, PlusCircle, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { LoadingNet } from '../../components/shared/LoadingNet';
import { useModal } from '../../context/ModalContext';
import { Button } from '../../components/shared/Button';
import { useState } from 'react';
import { ValidatedInput } from '../../components/shared/ValidatedInput';
import { validateRequired } from '../../utils/validationRules';
import { EmptyState } from '../../components/shared/EmptyState';
import { PrinterCard } from '../../components/admin/PrinterCard';
import { Checkbox } from '../../components/shared/Checkbox';

const AliasModalBody = ({ printerName, currentAlias, closeModal }: { printerName: string, currentAlias?: string, closeModal: () => void }) => {
  const { updatePrinterAlias } = useAdminStore();
  const { addToast } = useToast();
  const [newAlias, setNewAlias] = useState(currentAlias || '');
  const [isSaving, setIsSaving] = useState(false);

  const isFormValid = validateRequired(newAlias, 'Alias Name') === null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <ValidatedInput
        label="Alias Name"
        value={newAlias}
        onChange={setNewAlias}
        placeholder="e.g. Front Desk Printer"
        validateFn={(val) => validateRequired(val, 'Alias Name')}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
        <Button variant="ghost" onClick={closeModal}>Cancel</Button>
        <Button variant="mechanical" isLoading={isSaving} disabled={!isFormValid} onClick={async () => {
          if (!isFormValid) return;
          setIsSaving(true);
          try {
            const success = await updatePrinterAlias(printerName, newAlias);
            if (success) {
              addToast({ type: 'success', title: 'Alias Updated', description: `${printerName} is now known as ${newAlias}.` });
              closeModal();
            } else {
              addToast({ type: 'error', title: 'Update Failed', description: `Could not update alias for ${printerName}.` });
            }
          } catch (error: any) {
            addToast({ type: 'error', title: 'Update Failed', description: error.message || 'Unknown error occurred.' });
          } finally {
            setIsSaving(false);
          }
        }}>Save Alias</Button>
      </div>
    </div>
  );
};

const DeletePrinterModalBody = ({ printerName, closeModal }: { printerName: string, closeModal: () => void }) => {
  const { deletePrinter } = useAdminStore();
  const { addToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
        Are you sure you want to delete <strong>{printerName}</strong>? This action cannot be undone and will remove it from the system queue.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
        <Button variant="ghost" onClick={closeModal} disabled={isDeleting}>Cancel</Button>
        <Button variant="mechanical" style={{ background: 'var(--status-error)', borderColor: 'var(--status-error)', color: 'var(--text-primary)' }} isLoading={isDeleting} onClick={async () => {
          setIsDeleting(true);
          try {
            const success = await deletePrinter(printerName);
            if (success) {
              addToast({ type: 'success', title: 'Printer Deleted', description: `${printerName} has been removed.` });
              closeModal();
            } else {
              addToast({ type: 'error', title: 'Deletion Failed', description: `Could not delete ${printerName}.` });
            }
          } catch (error: any) {
            addToast({ type: 'error', title: 'Deletion Failed', description: error.message || 'Unknown error occurred.' });
          } finally {
            setIsDeleting(false);
          }
        }}>Delete Printer</Button>
      </div>
    </div>
  );
};

const DeleteAllPrintersModalBody = ({ closeModal }: { closeModal: () => void }) => {
  const { deleteAllPrinters } = useAdminStore();
  const { addToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
        Are you sure you want to delete <strong>all printers</strong>? This action cannot be undone and will completely clear the fleet.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
        <Button variant="ghost" onClick={closeModal} disabled={isDeleting}>Cancel</Button>
        <Button variant="mechanical" style={{ background: 'var(--status-error)', borderColor: 'var(--status-error)', color: 'var(--text-primary)' }} isLoading={isDeleting} onClick={async () => {
          setIsDeleting(true);
          try {
            const success = await deleteAllPrinters();
            if (success) {
              addToast({ type: 'success', title: 'Fleet Cleared', description: `All printers have been removed.` });
              closeModal();
            } else {
              addToast({ type: 'error', title: 'Deletion Failed', description: `Could not delete printers.` });
            }
          } catch (error: any) {
            addToast({ type: 'error', title: 'Deletion Failed', description: error.message || 'Unknown error occurred.' });
          } finally {
            setIsDeleting(false);
          }
        }}>Delete All</Button>
      </div>
    </div>
  );
};

const SetupWizardModalBody = ({ device, closeModal }: { device: { uri: string, rawModel: string }, closeModal: () => void }) => {
  const { loadPrinters, updatePrinterCapabilities } = useAdminStore();
  const { addToast } = useToast();

  const [step, setStep] = useState(1);
  const [alias, setAlias] = useState(device.rawModel);
  const [isConfiguring, setIsConfiguring] = useState(false);

  const isFormValid = validateRequired(alias, 'Alias Name') === null;

  const [queueName, setQueueName] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);

  const handleConfigure = async () => {
    if (!isFormValid) return;
    setIsConfiguring(true);
    try {
      console.log(device);
      const res = await api.configurePrinter(device.uri, device.rawModel);
      if (res.success && res.queueName) {
        setQueueName(res.queueName);

        if (alias !== device.rawModel) {
          await api.updateAlias(res.queueName, alias);
        }

        await loadPrinters();
        const newPrinter = useAdminStore.getState().printers.find(p => p.name === res.queueName);
        if (newPrinter && newPrinter.capabilities) {
          setCapabilities(newPrinter.capabilities);
        }

        setStep(2);
      } else {
        addToast({ type: 'error', title: 'Configuration Failed', description: res.error || 'Unknown error' });
        closeModal();
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Configuration Failed', description: err.message || 'Unknown error' });
      closeModal();
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleSaveCapabilities = async () => {
    setIsConfiguring(true);
    try {
      const success = await updatePrinterCapabilities(queueName, capabilities);
      if (success) {
        addToast({ type: 'success', title: 'Setup Complete', description: `${alias} is ready to use.` });

        useAdminStore.setState(state => ({
          detectedDevices: state.detectedDevices.filter(d => d.uri !== device.uri)
        }));

        closeModal();
      } else {
        addToast({ type: 'error', title: 'Update Failed', description: 'Failed to save capabilities.' });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Update Failed', description: e.message });
    } finally {
      setIsConfiguring(false);
    }
  };

  const toggleCapability = (cap: string) => {
    setCapabilities(prev => prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]);
  };

  if (step === 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Step 1: Device Identity</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
            Provide a friendly name for this hardware. The driver will be automatically selected based on the device model.
          </p>
        </div>

        <ValidatedInput
          label="Alias Name"
          value={alias}
          onChange={setAlias}
          placeholder="e.g. Front Desk Printer"
          validateFn={(val) => validateRequired(val, 'Alias Name')}
        />

        <div style={{ background: 'var(--bg-surface-alt)', padding: '1rem', borderRadius: '4px', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Detected Model</span>
            <span className="data-mono">{device.rawModel}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Hardware URI</span>
            <span className="data-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{device.uri}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <Button variant="ghost" onClick={closeModal}>Cancel</Button>
          <Button variant="mechanical" isLoading={isConfiguring} disabled={!isFormValid} onClick={handleConfigure}>Install Device</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h3 style={{ margin: '0 0 0.5rem 0' }}>Step 2: Hardware Capabilities</h3>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
          We've probed the hardware for features. Verify or override them manually if detection failed.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
        <Checkbox
          checked={capabilities.includes('color')}
          onChange={() => toggleCapability('color')}
        >
          Color Printing Support
        </Checkbox>
        <Checkbox
          checked={capabilities.includes('duplex')}
          onChange={() => toggleCapability('duplex')}
        >
          Automatic Duplex (Two-Sided)
        </Checkbox>
        <Checkbox
          checked={capabilities.includes('grayscale') && !capabilities.includes('color')}
          onChange={() => {
            if (capabilities.includes('color')) return; // Color implies grayscale
            toggleCapability('grayscale');
          }}
          disabled={capabilities.includes('color')}
        >
          <span style={{ opacity: capabilities.includes('color') ? 0.5 : 1 }}>Grayscale Only</span>
        </Checkbox>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
        <Button variant="ghost" onClick={() => handleSaveCapabilities()}>Skip / Keep Auto</Button>
        <Button variant="mechanical" isLoading={isConfiguring} onClick={handleSaveCapabilities}>Save & Finish</Button>
      </div>
    </div>
  );
};

const ConfigureDeviceButton = ({ device }: { device: { uri: string, rawModel: string } }) => {
  const { openModal, closeModal } = useModal();
  return (
    <Button
      variant="mechanical"
      style={{ padding: '0.5rem 1rem' }}
      rightIcon={<PlusCircle size={16} />}
      onClick={() => {
        openModal({
          title: 'Setup Wizard',
          content: <SetupWizardModalBody device={device} closeModal={closeModal} />
        });
      }}
    >
      Configure
    </Button>
  );
};


export function Fleet() {
  const { printers, isLoadingPrinters, loadPrinters, setDefaultPrinter, detectLegacyPrinter, isDetecting } = useAdminStore();
  const { addToast } = useToast();
  const { openModal, closeModal } = useModal();

  useEffect(() => {
    loadPrinters();
  }, [loadPrinters]);

  const handleSetDefault = async (name: string) => {
    try {
      const success = await setDefaultPrinter(name);
      if (success) {
        addToast({ type: 'success', title: 'Default Updated', description: `${name} is now the primary target.` });
      } else {
        addToast({ type: 'error', title: 'Update Failed', description: `Failed to set ${name} as default.` });
      }
    } catch (error: any) {
      addToast({ type: 'error', title: 'Update Failed', description: error.message || 'Unknown error occurred.' });
    }
  };

  const handleEditAlias = (printerName: string, currentAlias?: string) => {
    openModal({
      title: 'Edit Printer Alias',
      content: <AliasModalBody printerName={printerName} currentAlias={currentAlias} closeModal={closeModal} />
    });
  };

  const handleDetect = async () => {
    addToast({ type: 'info', title: 'Hardware Scan', description: 'Polling local USB and network ports for undocumented devices...', duration: 3000 });
    await detectLegacyPrinter();
    const count = useAdminStore.getState().detectedDevices.length;
    if (count > 0) {
      addToast({ type: 'success', title: 'Scan Complete', description: `Found ${count} unconfigured devices.` });
    } else {
      addToast({ type: 'warning', title: 'Scan Complete', description: `No new legacy devices found.` });
    }
  };

  const handleDeletePrinter = (printerName: string) => {
    openModal({
      title: 'Delete Printer',
      content: <DeletePrinterModalBody printerName={printerName} closeModal={closeModal} />
    });
  };

  const handleDeleteAllPrinters = () => {
    openModal({
      title: 'Delete All Printers',
      content: <DeleteAllPrintersModalBody closeModal={closeModal} />
    });
  };


  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <div className="fleet-header">
        <div>
          <h1 className="page-title">Hardware Fleet</h1>
          <p className="page-desc">Physical device topology and consumable levels</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button variant="danger" onClick={handleDeleteAllPrinters} rightIcon={<Trash2 size={18} />}>
            Delete All
          </Button>
          <Button variant="mechanical" onClick={handleDetect} isLoading={isDetecting} rightIcon={<Search size={18} />}>
            Detect Legacy Hardware
          </Button>
        </div>
      </div>

      {isLoadingPrinters ? (
        <LoadingNet message="Scanning hardware topology..." />
      ) : printers.length === 0 ? (
        <EmptyState
          icon={<Printer size={48} />}
          title="Your fleet is empty"
          description="Get started by detecting hardware or manually adding your first printer to track consumable levels and monitor activity."
        />
      ) : (
        <div className="fleet-grid">
          {printers.map(printer => (
            <PrinterCard
              key={printer.name}
              printer={printer}
              onEditAlias={handleEditAlias}
              onSetDefault={handleSetDefault}
              onDeletePrinter={handleDeletePrinter}
            />
          ))}
        </div>
      )}

      {useAdminStore.getState().detectedDevices.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Discovered Devices</h2>
          <div className="fleet-grid">
            {useAdminStore.getState().detectedDevices.map(device => (
              <div key={device.uri} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>{device.rawModel}</h3>
                  <div className="data-mono" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{device.uri}</div>
                </div>
                <ConfigureDeviceButton device={device} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
