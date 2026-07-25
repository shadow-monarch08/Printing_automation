import { useState } from 'react';
import { useUserPrintStore } from '../../stores/useUserPrintStore';
import { Receipt, ArrowLeft, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { LoadingNet } from '../../components/shared/LoadingNet';
import { Button } from '../../components/shared/Button';
import { soundFx } from '../../utils/sound';

export function QuoteReceipt() {
  const { quote, copies, colorMode, duplex, orientation, submitJob, goToStep } = useUserPrintStore();
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!quote) return null;

  const handleSubmit = async () => {
    soundFx.playClick();
    setIsSubmitting(true);
    try {
      await submitJob();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Job Dispatch Failed',
        description: err.message || 'Unable to route print payload to hardware.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <div className="receipt-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '360px' }}>
        <LoadingNet message="Encrypting Payload & Locking Print Queue Ticket..." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', flex: 1, width: '100%' }}>

      {/* Header */}
      <div className="receipt-header" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            [JOB_QUOTE_VERIFICATION]
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Inspect itemized hardware rates before locking ticket
          </p>
        </div>
        <Button variant="ghost" onClick={() => goToStep(2)} leftIcon={<ArrowLeft size={16} />} style={{ minHeight: '36px' }}>
          Modify Parameters
        </Button>
      </div>

      {/* Tractor-Feed Cardstock Receipt Slip */}
      <div 
        className="card paper-sheet receipt-card"
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--bg-paper)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-paper)',
          padding: '24px 20px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
      >
        <div className="tear-line" style={{ marginTop: '0', marginBottom: '16px' }} />

        <div style={{ textAlign: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '16px', marginBottom: '20px' }}>
          <Receipt size={36} color="var(--accent-primary)" style={{ margin: '0 auto 8px auto' }} />
          <h3 style={{ margin: 0, fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            [OFFICIAL_QUOTE_SLIP]
          </h3>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            ESTIMATED DISPATCH ETA: {quote.eta || 'IMMEDIATE'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--border-default)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>TOTAL PAGES</span>
            <span style={{ fontWeight: 700 }}>{quote.totalPages}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--border-default)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>COPIES REQUESTED</span>
            <span style={{ fontWeight: 700 }}>{copies}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--border-default)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>COLOR TIER RATE</span>
            <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{colorMode}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--border-default)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>DUPLEX DISCOUNT</span>
            <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{duplex}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--border-default)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>ORIENTATION</span>
            <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{orientation}</span>
          </div>

          <div 
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '2px dashed var(--border-default)',
              paddingTop: '16px',
              marginTop: '16px'
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.05em' }}>TOTAL COST</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--accent-primary)' }}>
              ₹{quote.totalCost}
            </span>
          </div>
        </div>

        {/* Desktop inline action button */}
        <div className="desktop-action-only" style={{ marginTop: '24px' }}>
          <Button
            variant="mechanical"
            onClick={handleSubmit}
            leftIcon={<Printer size={20} />}
            style={{ width: '100%', minHeight: '48px', fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}
          >
            [ CONFIRM & PRINT TICKET — ₹{quote.totalCost} ]
          </Button>
        </div>
      </div>

      {/* Mobile Pinned Bottom Sticky Action Bar */}
      <div className="mobile-bottom-bar">
        <Button 
          variant="mechanical" 
          onClick={handleSubmit} 
          leftIcon={<Printer size={20} />}
          style={{ width: '100%', minHeight: '48px', fontFamily: 'var(--font-mono)', fontWeight: 800 }}
        >
          [ CONFIRM & PRINT — ₹{quote.totalCost} ]
        </Button>
      </div>

    </div>
  );
}
