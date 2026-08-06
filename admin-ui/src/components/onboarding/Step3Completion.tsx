interface Step3CompletionProps {
  mode?: 'full' | 'wifi-only';
}

export function Step3Completion({ mode = 'full' }: Step3CompletionProps) {
  const isWifiOnly = mode === 'wifi-only';

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
          [ ✓ ] {isWifiOnly ? 'WI-FI_RECONFIGURED_SUCCESSFULLY' : 'TERMINAL_ONLINE_AND_PROVISIONED'}
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', margin: 0, maxWidth: '480px' }}>
          {isWifiOnly 
            ? 'Your kiosk terminal has re-authenticated and joined the target network with its active shop identity.'
            : 'Your kiosk terminal has successfully authenticated and connected to your shop network.'}
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

      {/* Local Data File Panel */}
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
          [2] LOCAL FILE FALLBACK
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
          The public access URL is persisted on the local filesystem at:
        </p>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border-default)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-primary)',
          }}
        >
          server/data/cloudflare_url.txt
        </div>
      </div>
    </div>
  );
}
