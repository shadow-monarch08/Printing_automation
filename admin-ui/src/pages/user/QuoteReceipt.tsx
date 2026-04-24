// src/pages/user/QuoteReceipt.tsx
import { useState } from 'react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { Receipt, ArrowLeft, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export function QuoteReceipt() {
  const { quote, filePreview, submitJob, goToStep } = useUserPrintStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  if (!quote || !filePreview) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await submitJob();
    setIsSubmitting(false);
    addToast({ type: 'success', title: 'Job Dispatched', description: 'Your document is heading to the local printer queue.' });
  };

  return (
    <div className="receipt-wrapper">
      
      <div className="card paper-sheet receipt-card">
        {/* Receipt Header */}
        <div style={{ background: 'var(--bg-surface-alt)', padding: '2rem 1.5rem 1.5rem', textAlign: 'center' }}>
          <Receipt size={32} color="var(--text-primary)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '1.5rem' }}>Final Quote</h2>
          <div className="data-mono" style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>ID: TKT-{Math.floor(Math.random()*10000)}</div>
        </div>

        <div className="tear-line" style={{ margin: 0 }}></div>

        {/* Receipt Body */}
        <div style={{ padding: '1.5rem', fontFamily: 'var(--font-mono)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ITEM</div>
            <div style={{ wordBreak: 'break-all', fontWeight: 600 }}>{filePreview.name}</div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span>Pages to Print</span>
            <span>{quote.totalPages}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span>Rate per Page</span>
            <span>₹{quote.costPerPage}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: '1rem', marginTop: '1rem', fontWeight: 700, fontSize: '1.25rem' }}>
            <span>TOTAL DEBT</span>
            <span>₹{quote.totalCost}</span>
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            EST. WAIT TIME: {quote.eta}
          </div>
        </div>
      </div>

      <div className="receipt-actions">
        <button className="btn-ghost" onClick={() => goToStep(2)} disabled={isSubmitting}>
          <ArrowLeft size={18} /> Modify Config
        </button>
        <button className="btn-mechanical" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Transmitting...' : 'Authorize Print'} <Printer size={18} />
        </button>
      </div>

    </div>
  );
}
