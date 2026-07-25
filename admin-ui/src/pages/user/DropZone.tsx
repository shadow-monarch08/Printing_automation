import { useRef, useState } from 'react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { useToast } from '../../context/ToastContext';
import { LoadingNet } from '../../components/shared/LoadingNet';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { FileText, Trash2, CheckCircle2, ChevronRight } from 'lucide-react';
import { soundFx } from '../../utils/sound';

export function DropZone() {
  const { file, filePreview, setFile, reset, goToStep, isAcceptingJobs } = useUserPrintStore();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = async (selectedFile: File) => {
    if (isAcceptingJobs === false) return;
    if (selectedFile.size > 50 * 1024 * 1024) {
      addToast({ type: 'error', title: 'File size exceeded', description: 'Maximum permitted payload is 50MB.' });
      return;
    }
    soundFx.playClick();
    setIsUploading(true);
    await setFile(selectedFile);
    setIsUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAcceptingJobs === false) return;
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isAcceptingJobs === false) return;
    const selectedFile = e.dataTransfer.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  if (isUploading) {
    return (
      <div className="dropzone-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '360px' }}>
        <LoadingNet message="Analyzing Document Topology & Rasterizing Pages..." />
      </div>
    );
  }

  // If a file is attached, render Stenciled Folder Tag Card & Bottom Bar
  if (file) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    const pagesCount = filePreview?.pages || 1;

    return (
      <div className="dropzone-container" style={{ width: '100%' }}>
        <div 
          className="folder-tag-card card"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '2px solid var(--accent-primary)',
            borderRadius: 'var(--radius-md, 4px)',
            padding: '24px 16px',
            boxShadow: '0 8px 32px var(--accent-glow)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
            <CheckCircle2 size={24} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em' }}>
              [PAYLOAD_LOADED]
            </span>
          </div>

          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              backgroundColor: 'var(--bg-surface-alt)',
              border: '1px solid var(--border-default)',
              padding: '12px 16px',
              borderRadius: '4px',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <FileText size={28} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                <div 
                  style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: 700, 
                    fontSize: '0.85rem', 
                    color: 'var(--text-primary)', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap' 
                  }}
                >
                  {file.name}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '2px', fontWeight: 700 }}>
                  [{pagesCount} {pagesCount === 1 ? 'PAGE' : 'PAGES'}] • {sizeInMb} MB
                </div>
              </div>
            </div>

            <Button 
              variant="danger" 
              onClick={reset} 
              leftIcon={<Trash2 size={14} />}
              style={{ minHeight: '36px', padding: '0.4rem 0.8rem', fontSize: '0.75rem', flexShrink: 0 }}
            >
              [EJECT]
            </Button>
          </div>

          {/* Desktop inline action button */}
          <div className="desktop-action-only" style={{ marginTop: '8px', width: '100%', maxWidth: '320px' }}>
            <Button 
              variant="primary" 
              onClick={() => goToStep(2)} 
              rightIcon={<ChevronRight size={18} />}
              style={{ width: '100%', minHeight: '48px', fontFamily: 'var(--font-mono)', fontWeight: 800 }}
            >
              PROCEED TO CONFIG &rarr;
            </Button>
          </div>
        </div>

        {/* Mobile Pinned Bottom Sticky Action Bar */}
        <div className="mobile-bottom-bar">
          <Button 
            variant="mechanical" 
            onClick={() => goToStep(2)} 
            rightIcon={<ChevronRight size={18} />}
            style={{ width: '100%', minHeight: '48px', fontFamily: 'var(--font-mono)', fontWeight: 800 }}
          >
            PROCEED TO CONFIG &rarr;
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="dropzone-container" style={{ width: '100%' }}>
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" 
        onChange={handleFileChange}
      />
      
      <EmptyState
        iconType="printer-hatch"
        title="[INITIALIZE_JOB_PAYLOAD]"
        description="Drag & drop document or tap to browse local storage"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          cursor: 'pointer',
          border: isDragOver ? '3px solid var(--accent-primary)' : '3px dashed var(--border-default)',
          boxShadow: isDragOver ? 'inset 0 0 32px var(--accent-glow)' : 'inset 0 0 12px rgba(0, 0, 0, 0.2)',
          minHeight: '240px',
          padding: '36px 16px'
        }}
      >
        <div className="dropzone-badges" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="badge badge-default" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>[PDF]</span>
          <span className="badge badge-default" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>[DOCX]</span>
          <span className="badge badge-default" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>[IMAGES]</span>
        </div>
      </EmptyState>
    </div>
  );
}
