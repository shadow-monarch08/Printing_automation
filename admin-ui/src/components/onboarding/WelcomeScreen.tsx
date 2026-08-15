import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/Button';
import type { HandoffData } from '../../types';
import { ExternalLink, ShieldCheck, Printer, Globe, Wifi } from 'lucide-react';

interface WelcomeScreenProps {
  data: HandoffData;
  onContinue: () => void;
}

export function WelcomeScreen({ data, onContinue }: WelcomeScreenProps) {
  const navigate = useNavigate();

  const handleGoToAdmin = () => {
    onContinue();
    navigate('/admin');
  };

  const handleGoToKiosk = () => {
    onContinue();
    navigate('/');
  };

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="onboarding-canvas">
      <div className="onboarding-console-card" style={{ maxWidth: '680px' }}>
        {/* Top Header Strip */}
        <div className="onboarding-header-strip">
          <div className="onboarding-header-title">
            <span className="led-diode green" />
            <span>TERMINAL_PROVISIONED // SYSTEM_READY</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--status-idle)', fontWeight: 700 }}>
            [ONLINE]
          </div>
        </div>

        {/* Main Body */}
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Status Plate */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '12px',
              padding: '16px 8px',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                background: 'rgba(0, 200, 83, 0.12)',
                border: '2px solid var(--status-idle)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--status-idle)',
              }}
            >
              <ShieldCheck size={32} />
            </div>

            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                [ {data.shopName || 'MODERN PRESS'} ]
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginTop: '4px',
                  maxWidth: '480px',
                }}
              >
                Kiosk hardware, identity tokens, and secure remote gateways are fully provisioned and operational.
              </div>
            </div>
          </div>

          {/* Remote Access Cloudflare Card */}
          {data.tunnelUrl && (
            <div
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={16} color="var(--accent-secondary)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                    [1] PUBLIC_REMOTE_ACCESS_ENDPOINT
                  </span>
                </div>
                <span className="led-diode green" />
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  background: 'var(--bg-surface)',
                  border: '1px dashed var(--border-default)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--accent-primary)',
                  wordBreak: 'break-all',
                }}
              >
                {data.tunnelUrl}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <Button
                  variant="primary"
                  onClick={() => handleOpenLink(data.tunnelUrl)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', height: '36px', padding: '0 16px' }}
                >
                  <ExternalLink size={14} style={{ marginRight: '6px' }} />
                  <span>[ OPEN REMOTE ACCESS ]</span>
                </Button>
              </div>
            </div>
          )}

          {/* Local Network Access Card */}
          {data.localAccessUrl && (
            <div
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wifi size={16} color="var(--text-secondary)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    [2] LOCAL_NETWORK_GATEWAY
                  </span>
                </div>
                <span className="led-diode green" />
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  background: 'var(--bg-surface)',
                  border: '1px dashed var(--border-default)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  wordBreak: 'break-all',
                }}
              >
                {data.localAccessUrl}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <Button
                  variant="ghost"
                  onClick={() => handleOpenLink(data.localAccessUrl!)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', height: '36px', padding: '0 16px' }}
                >
                  <ExternalLink size={14} style={{ marginRight: '6px' }} />
                  <span>[ OPEN LOCAL ACCESS ]</span>
                </Button>
              </div>
            </div>
          )}

          {/* Printer Fleet Status Plate */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Printer size={20} color="var(--text-secondary)" />
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  HARDWARE_FLEET // {data.printerCount || 0} PRINTERS DETECTED
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {(data.printerCount || 0) === 0
                    ? 'Connect USB/Network printers and configure aliases from the Admin Control Room.'
                    : 'Printers are registered and ready to receive customer print jobs.'}
                </div>
              </div>
            </div>
          </div>

          {/* Action Navigation Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            <Button
              variant="mechanical"
              onClick={handleGoToAdmin}
              style={{
                width: '100%',
                height: '48px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              [ GO TO ADMIN CONTROL ROOM ➔ ]
            </Button>

            <Button
              variant="ghost"
              onClick={handleGoToKiosk}
              style={{
                width: '100%',
                height: '42px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
              }}
            >
              [ OPEN CUSTOMER PRINT KIOSK ]
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
