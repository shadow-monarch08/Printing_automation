// src/pages/user/DropZone.tsx
import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { useToast } from '../../context/ToastContext';
import { LoadingNet } from '../../components/shared/LoadingNet';

export function DropZone() {
  const { setFile, isAcceptingJobs } = useUserPrintStore();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const processFile = async (file: File) => {
    if (isAcceptingJobs === false) return; // Block file processing if offline
    if (file.size > 50 * 1024 * 1024) {
      addToast({ type: 'error', title: 'File too large', description: 'Maximum permitted file size is 50MB.' });
      return;
    }
    setIsUploading(true);
    await setFile(file);
    setIsUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAcceptingJobs === false) return;
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isAcceptingJobs === false) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  if (isUploading) {
    return (
      <div className="dropzone-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingNet message="Analyzing Document Topology..." />
      </div>
    );
  }

  return (
    <div className="dropzone-container">
      <div 
        className="dropzone-area"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud size={56} style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
        <h2 className="dropzone-title">Initialize Job Payload</h2>
        <p className="dropzone-desc">Drag and drop document here, or tap to browse</p>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" 
          onChange={handleFileChange}
        />
        
        <div className="dropzone-badges">
          <span className="badge badge-default">PDF</span>
          <span className="badge badge-default">DOCX</span>
          <span className="badge badge-default">IMAGES</span>
        </div>
      </div>
    </div>
  );
}
