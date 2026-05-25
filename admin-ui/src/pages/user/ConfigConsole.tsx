// src/pages/user/ConfigConsole.tsx
import { useState, useEffect } from 'react';
import { Settings, FileText, ChevronRight, ArrowLeft } from 'lucide-react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { Button } from '../../components/shared/Button';

export function ConfigConsole() {
  const { filePreview, copies, colorMode, duplex, orientation, updateConfig, generateQuote, reset, fleetCapabilities } = useUserPrintStore();

  if (!filePreview) return null;

  const hasColor = fleetCapabilities?.color ?? true;
  const hasDuplex = fleetCapabilities?.duplex ?? true;

  // If a previously selected capability becomes disabled, fallback.
  useEffect(() => {
    let changed = false;
    const updates: any = {};
    if (!hasColor && colorMode === 'color') {
      updates.colorMode = 'grayscale';
      changed = true;
    }
    if (!hasDuplex && duplex === 'double') {
      updates.duplex = 'single';
      changed = true;
    }
    if (changed) {
      updateConfig(updates);
    }
  }, [hasColor, hasDuplex, colorMode, duplex, updateConfig]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
      
      {/* Title Area */}
      <div className="config-header">
          <div className="config-header-text">
              <h2>Job Manifest Configurator</h2>
              <p>Set hardware routing and styling parameters for payload</p>
          </div>
          <Button variant="ghost" onClick={reset} leftIcon={<ArrowLeft size={16} />}>
              Cancel & Eject
          </Button>
      </div>

      <div className="config-split">
        
        {/* Left pane: File details */}
        <div className="card paper-sheet config-payload">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '1rem' }}>
            <FileText size={24} color="var(--accent-primary)" />
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Payload Sighted</h2>
          </div>
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>TARGET FILENAME</div>
              <div className="data-mono" style={{ fontSize: '1.1rem', wordBreak: 'break-all', color: 'var(--text-primary)' }}>{filePreview.name}</div>
            </div>
            
            <div className="tear-line"></div>

            <div style={{ display: 'flex', gap: '3rem' }}>
              <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>FILE SIZE</div>
                  <div className="data-mono" style={{ fontSize: '1.2rem' }}>{(filePreview.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
              <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>EST. PAGES</div>
                  <div className="data-mono" style={{ fontSize: '1.2rem' }}>{filePreview.pages}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right pane: Configuration */}
        <div className="card config-settings-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '1rem' }}>
            <Settings size={24} color="var(--text-primary)" />
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Print Array Settings</h2>
          </div>

          <div className="config-grid">
            <CustomSelect
                label="Color Mode"
                value={colorMode}
                onChange={v => updateConfig({ colorMode: v as any })}
                options={[
                    { value: 'grayscale', label: 'Black & White (Economical)' },
                    { value: 'color', label: 'Full Color', disabled: !hasColor }
                ]}
            />

            <CustomSelect
                label="Document Layout"
                value={duplex}
                onChange={v => updateConfig({ duplex: v as any })}
                options={[
                    { value: 'single', label: 'Single Sided' },
                    { value: 'double', label: 'Double Sided (Duplex)', disabled: !hasDuplex }
                ]}
            />

            <CustomSelect
                label="Orientation"
                value={orientation}
                onChange={v => updateConfig({ orientation: v as any })}
                options={[
                    { value: 'portrait', label: 'Portrait' },
                    { value: 'landscape', label: 'Landscape' }
                ]}
            />

            <div>
              <label className="custom-select-label">Copies</label>
              <input 
                type="number" 
                className="input-field" 
                min="1" 
                max="100" 
                value={copies} 
                onChange={e => updateConfig({ copies: parseInt(e.target.value) || 1 })}
                style={{ padding: '0.7rem 1rem' }}
              />
            </div>
          </div>

          <div className="config-action-bar">
            <Button 
              variant="mechanical"
              className="config-generate-btn" 
              onClick={generateQuote}
              rightIcon={<ChevronRight size={24} />}
            >
              Generate Cost Quote
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
