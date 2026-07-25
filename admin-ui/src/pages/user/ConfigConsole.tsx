import { useEffect } from 'react';
import { Settings, FileText, ChevronRight, ArrowLeft, Plus, Minus, Eye } from 'lucide-react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { Button } from '../../components/shared/Button';
import { Checkbox } from '../../components/shared/Checkbox';
import { useModal } from '../../context/ModalContext';
import { soundFx } from '../../utils/sound';

const DocumentPreviewModal = ({ name, size, pages }: { name: string; size: number; pages: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 8px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
      <FileText size={32} color="var(--accent-primary)" />
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
          {name}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          {(size / 1024 / 1024).toFixed(2)} MB • {pages} PAGES
        </div>
      </div>
    </div>
    <div style={{ backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-default)', height: '220px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        [PAGE 1 OF {pages} - PREVIEW MODE]
      </div>
    </div>
  </div>
);

export function ConfigConsole() {
  const { filePreview, copies, colorMode, duplex, orientation, updateConfig, generateQuote, reset, fleetCapabilities } = useUserPrintStore();
  const { openModal } = useModal();

  if (!filePreview) return null;

  const hasColor = fleetCapabilities?.color ?? true;
  const hasDuplex = fleetCapabilities?.duplex ?? true;

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

  const handleCopiesChange = (newCount: number) => {
    if (newCount >= 1 && newCount <= 100) {
      soundFx.playClick();
      updateConfig({ copies: newCount });
    }
  };

  const handleOpenPreviewModal = () => {
    soundFx.playClick();
    openModal({
      title: 'Document Preview Inspect',
      content: <DocumentPreviewModal name={filePreview.name} size={filePreview.size} pages={filePreview.pages} />
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, width: '100%' }}>

      {/* Header */}
      <div className="config-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            [JOB_MANIFEST_CONFIGURATOR]
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Set hardware routing and styling parameters
          </p>
        </div>
        <Button variant="ghost" onClick={reset} leftIcon={<ArrowLeft size={16} />} style={{ minHeight: '36px' }}>
          Cancel & Eject
        </Button>
      </div>

      {/* Collapsible Document Preview Bar for Mobile */}
      <div 
        onClick={handleOpenPreviewModal}
        style={{
          width: '100%',
          minHeight: '44px',
          padding: '0 12px',
          backgroundColor: 'var(--bg-paper)',
          border: '1px solid var(--border-default)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <FileText size={18} color="var(--accent-primary)" />
          <span>📄 {filePreview.name} ({filePreview.pages} PAGES)</span>
        </div>
        <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Eye size={14} /> [TAP TO INSPECT]
        </span>
      </div>

      <div className="config-split" style={{ width: '100%' }}>

        {/* Left Column: Paper Preview Frame (Desktop) */}
        <div 
          className="card paper-sheet config-payload desktop-only"
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-paper)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-paper)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}
        >
          <div className="tear-line" style={{ marginTop: '0', marginBottom: '16px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '1rem' }}>
            <FileText size={28} color="var(--accent-primary)" />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 700 }}>[DOCUMENT_TARGET]</div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>Payload Sighted</h3>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.05em' }}>
                TARGET FILENAME
              </div>
              <div className="data-mono" style={{ fontSize: '1.05rem', fontWeight: 700, wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                {filePreview.name}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', backgroundColor: 'var(--bg-surface-alt)', padding: '16px', borderRadius: '4px', border: '1px solid var(--border-default)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>PAYLOAD SIZE</div>
                <div className="data-mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {(filePreview.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>ESTIMATED PAGES</div>
                <div className="data-mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {filePreview.pages} PAGES
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Machined Control Panel */}
        <div 
          className="card config-settings-card"
          style={{
            flex: 1.2,
            backgroundColor: 'var(--bg-surface)',
            border: '2px solid var(--border-default)',
            borderRadius: 'var(--radius-md, 4px)',
            boxShadow: 'var(--shadow-paper)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '10px' }}>
            <Settings size={22} color="var(--accent-primary)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              [HARDWARE_ARRAY_PARAMETERS]
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>

            {/* Touch Stepper Grid for Copies */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                [1] COPIES STEPPER
              </label>
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '56px 1fr 56px', 
                  minHeight: '48px', 
                  border: '1px solid var(--border-default)', 
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg-primary)',
                  overflow: 'hidden'
                }}
              >
                <Button 
                  variant="mechanical" 
                  onClick={() => handleCopiesChange(copies - 1)} 
                  disabled={copies <= 1}
                  style={{ borderRadius: 0, minHeight: '48px', fontSize: '1.2rem', fontWeight: 800 }}
                >
                  <Minus size={20} />
                </Button>
                <div 
                  className="data-mono"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem',
                    fontWeight: 800,
                    color: 'var(--accent-primary)'
                  }}
                >
                  {copies}
                </div>
                <Button 
                  variant="mechanical" 
                  onClick={() => handleCopiesChange(copies + 1)} 
                  disabled={copies >= 100}
                  style={{ borderRadius: 0, minHeight: '48px', fontSize: '1.2rem', fontWeight: 800 }}
                >
                  <Plus size={20} />
                </Button>
              </div>
            </div>

            {/* Color Mode Tier CustomSelect */}
            <div>
              <CustomSelect
                label="[2] COLOR MODE TIER"
                value={colorMode}
                onChange={v => updateConfig({ colorMode: v as any })}
                options={[
                  { value: 'grayscale', label: 'MONOCHROME [BLACK_INK]' },
                  { value: 'color', label: 'FULL COLOR [CMYK_OFFSET]', disabled: !hasColor }
                ]}
              />
            </div>

            {/* Duplex DIP Switch */}
            <div style={{ minHeight: '48px', display: 'flex', alignItems: 'center' }}>
              <Checkbox
                label="Double Sided (Duplex Discount Applied)"
                checked={duplex === 'double'}
                onChange={(checked: boolean) => updateConfig({ duplex: checked ? 'double' : 'single' })}
                disabled={!hasDuplex}
              />
            </div>

            {/* Orientation Selection */}
            <div>
              <CustomSelect
                label="[4] ORIENTATION"
                value={orientation}
                onChange={v => updateConfig({ orientation: v as any })}
                options={[
                  { value: 'portrait', label: 'PORTRAIT [STANDARD]' },
                  { value: 'landscape', label: 'LANDSCAPE [ROTATED]' }
                ]}
              />
            </div>
          </div>

          <div className="config-action-bar desktop-only" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-default)' }}>
            <Button
              variant="mechanical"
              className="config-generate-btn"
              onClick={generateQuote}
              rightIcon={<ChevronRight size={24} />}
              style={{ width: '100%', minHeight: '48px', fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}
            >
              GENERATE COST QUOTE &rarr;
            </Button>
          </div>
        </div>

      </div>

      {/* Mobile Pinned Bottom Sticky Action Bar */}
      <div className="mobile-bottom-bar">
        <Button 
          variant="mechanical" 
          onClick={generateQuote} 
          rightIcon={<ChevronRight size={24} />}
          style={{ width: '100%', minHeight: '48px', fontFamily: 'var(--font-mono)', fontWeight: 800 }}
        >
          GENERATE COST QUOTE &rarr;
        </Button>
      </div>

    </div>
  );
}
