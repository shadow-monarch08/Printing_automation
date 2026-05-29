// src/pages/admin/Settings.tsx
import { useEffect, useState } from 'react';
import { useAdminStore } from '../../stores/useAdminStore';
import { useToast } from '../../context/ToastContext';
import { useModal } from '../../context/ModalContext';
import { Settings as SettingsIcon, Save, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import type { PricingConfig } from '../../types';
import { LoadingNet } from '../../components/shared/LoadingNet';
import { Button } from '../../components/shared/Button';
import { ValidatedInput } from '../../components/shared/ValidatedInput';

export function Settings() {
  const { pricingConfig, isLoadingPricing, loadPricingConfig, updatePricingConfig } = useAdminStore();
  const { addToast } = useToast();
  const { openModal, closeModal } = useModal();
  
  const [localConfig, setLocalConfig] = useState<PricingConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPricingConfig();
  }, [loadPricingConfig]);

  useEffect(() => {
    if (pricingConfig) setLocalConfig({ ...pricingConfig });
  }, [pricingConfig]);

  if (isLoadingPricing && !localConfig) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <LoadingNet message="Loading pricing rules..." />
      </div>
    );
  }

  if (!localConfig) return null;

  const handleChange = (key: keyof PricingConfig, value: string | number) => {
      setLocalConfig(prev => prev ? { ...prev, [key]: value } : null);
  };

  const isFormValid = localConfig &&
    localConfig.bwPerPage >= 0 &&
    localConfig.colorPerPage >= 0 &&
    localConfig.duplexDiscount >= 0 &&
    localConfig.bulkThreshold >= 0 &&
    localConfig.bulkDiscount >= 0;

  const handleSave = async () => {
      if (!isFormValid) return;
      setIsSaving(true);
      try {
        const success = await updatePricingConfig(localConfig);
        if (success) {
            addToast({ type: 'success', title: 'Settings Saved', description: 'Global pricing constraints updated successfully.' });
        } else {
            addToast({ type: 'error', title: 'Save Failed', description: 'Failed to update pricing constraints.' });
        }
      } catch (error: any) {
        addToast({ type: 'error', title: 'Save Failed', description: error.message || 'Unknown error occurred.' });
      } finally {
        setIsSaving(false);
      }
  };

  const handleReset = () => {
      openModal({
          title: 'Confirm Factory Reset',
          content: <p>This will strip all custom pricing and revert to factory defaults. Proceed?</p>,
          footer: (
              <>
                <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                <Button variant="danger" onClick={async () => {
                    await api.resetPricingConfig();
                    loadPricingConfig();
                    closeModal();
                    addToast({ type: 'warning', title: 'Factory Reset', description: 'Defaults applied.' });
                }}>Reset</Button>
              </>
          )
      });
  };

  // Preview Calculations
  const previewPages = 60;
  const colorCost = localConfig.colorPerPage * previewPages;
  const previewDiscount = localConfig.bulkDiscount;

  return (
    <div className="settings-layout">
      
      <div className="settings-main">
         <header style={{ marginBottom: '2rem' }}>
           <h1 className="page-title">Economics</h1>
           <p className="page-desc">Global pricing matrix configuration</p>
         </header>

         <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SettingsIcon size={20} /> Pricing Algorithm
            </h3>

            <div className="settings-grid" style={{ marginBottom: '2rem' }}>
               <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                     Base Rate (Black & White)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ padding: '0.6rem 1rem', background: 'var(--bg-surface-alt)', border: '1px solid var(--input-border)', borderRight: 'none', borderRadius: '2px 0 0 2px', flexShrink: 0 }}>{localConfig.currency}</span>
                      <ValidatedInput 
                         type="number" 
                         className="flex-input-override" 
                         value={String(localConfig.bwPerPage)} 
                         onChange={v => handleChange('bwPerPage', Number(v))} 
                         validateFn={v => Number(v) < 0 ? 'Cannot be negative' : null}
                      />
                  </div>
               </div>
               
               <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                     Color Premium Rate
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ padding: '0.6rem 1rem', background: 'var(--bg-surface-alt)', border: '1px solid var(--input-border)', borderRight: 'none', borderRadius: '2px 0 0 2px', flexShrink: 0 }}>{localConfig.currency}</span>
                      <ValidatedInput 
                         type="number" 
                         className="flex-input-override" 
                         value={String(localConfig.colorPerPage)} 
                         onChange={v => handleChange('colorPerPage', Number(v))} 
                         validateFn={v => Number(v) < 0 ? 'Cannot be negative' : null}
                      />
                  </div>
               </div>
            </div>

            <h3 style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border-default)', paddingTop: '1.5rem' }}>Incentives & Penalties</h3>
            
            <div className="settings-grid">
               <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                     Duplex Discount (%)
                  </label>
                  <ValidatedInput 
                     type="number" 
                     value={String(localConfig.duplexDiscount)} 
                     onChange={v => handleChange('duplexDiscount', Number(v))} 
                     validateFn={v => Number(v) < 0 ? 'Cannot be negative' : null}
                  />
               </div>
               <div />

               <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                     Bulk Volume Threshold (Pages)
                  </label>
                  <ValidatedInput 
                     type="number" 
                     value={String(localConfig.bulkThreshold)} 
                     onChange={v => handleChange('bulkThreshold', Number(v))} 
                     validateFn={v => Number(v) < 0 ? 'Cannot be negative' : null}
                  />
               </div>
               
               <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                     Bulk Volume Discount (%)
                  </label>
                  <ValidatedInput 
                     type="number" 
                     value={String(localConfig.bulkDiscount)} 
                     onChange={v => handleChange('bulkDiscount', Number(v))} 
                     validateFn={v => Number(v) < 0 ? 'Cannot be negative' : null}
                  />
               </div>
            </div>
         </div>

         <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Button variant="mechanical" onClick={handleSave} isLoading={isSaving} disabled={!isFormValid} leftIcon={<Save size={18} />} style={{ padding: '0.75rem 2rem' }}>
               Compile Changes
            </Button>
            <Button variant="ghost" onClick={handleReset} leftIcon={<RefreshCw size={18} />}>
               Restore Defaults
            </Button>
         </div>
      </div>

      {/* Preview Pane */}
      <div className="settings-preview">
         <div style={{ position: 'sticky', top: '2rem' }}>
            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Real-time Matrix Testing</h4>
            <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-surface-alt)', borderStyle: 'dashed' }}>
               
               <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>TEST SCENARIO</div>
                  <div className="data-mono" style={{ fontSize: '1rem' }}>{previewPages} Pages • Color • Single Sided</div>
               </div>

               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                  <span>Base Rate ({previewPages}x)</span>
                  <span>{localConfig.currency}{colorCost.toFixed(2)}</span>
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--status-idle)', fontFamily: 'var(--font-mono)' }}>
                  <span>Bulk Adj. (-{previewDiscount}%)</span>
                  <span>-{localConfig.currency}{(colorCost * previewDiscount / 100).toFixed(2)}</span>
               </div>

               <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '2px dashed var(--border-default)', fontWeight: 700, fontSize: '1.4rem', fontFamily: 'var(--font-mono)' }}>
                  <span>TOTAL</span>
                  <span>{localConfig.currency}{(colorCost * (1 - previewDiscount/100)).toFixed(2)}</span>
               </div>
            </div>
         </div>
      </div>

    </div>
  );
}
