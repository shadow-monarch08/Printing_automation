import { Button } from '../shared/Button';

export function Step3Completion() {
  const handleLaunchDashboard = () => {
    window.location.href = '/admin';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'center', padding: '16px 8px' }}>
      {/* Emerald Badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            background: 'rgba(0, 200, 83, 0.1)',
            border: '2px solid var(--status-idle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--status-idle)',
          }}
        >
          ✓
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--status-idle)' }}>
          [ ✓ ] TERMINAL_ONLINE_AND_PROVISIONED
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', margin: 0, maxWidth: '480px' }}>
          Your kiosk terminal has successfully authenticated and connected to your shop network.
        </p>
      </div>

      {/* HDMI Screen Panel */}
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px 20px',
          textAlign: 'left',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--accent-secondary)', marginBottom: '4px' }}>
          [1] ATTACHED DISPLAY ACCESS
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>
          Inspect the attached Raspberry Pi HDMI display screen to scan the live public Cloudflare QR code.
        </p>
      </div>

      {/* Local Disk Backup Panel */}
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px 20px',
          textAlign: 'left',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>
          [2] LOCAL FILE BACKUP
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>
          Inspect the live public tunnel access URL on local storage at:
        </p>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--accent-primary)',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '8px 12px',
            borderRadius: '2px',
            marginTop: '8px',
            border: '1px dashed var(--border-default)',
          }}
        >
          server/data/cloudflare_url.txt
        </div>
      </div>

      {/* CTA Button */}
      <Button
        variant="primary"
        onClick={handleLaunchDashboard}
        style={{
          width: '100%',
          height: '48px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop: '8px',
        }}
      >
        [ INITIALIZE MANAGEMENT DASHBOARD ➔ ]
      </Button>
    </div>
  );
}
