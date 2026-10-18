export function Step3Completion() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center', padding: '16px 8px' }}>
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
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--status-idle)' }}>
          [ ✓ ] CONFIGURATION_DISPATCHED // HANDOFF_COMPLETE
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', margin: 0, maxWidth: '480px', lineHeight: 1.5 }}>
          Your shop identity and Wi-Fi credentials have been transferred to the physical kiosk terminal.
        </p>
      </div>

      {/* Action 1: Disconnecting Hotspot notice */}
      <div
        style={{
          background: 'rgba(255, 85, 0, 0.08)',
          border: '1.5px solid var(--accent-primary)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px 20px',
          textAlign: 'left',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>
          [1] SETUP_HOTSPOT_DISCONNECTING
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
          This phone will now disconnect from <strong>Kiosk-Hotspot</strong> as the terminal hardware radio cycles to link with your shop Wi-Fi network.
        </p>
      </div>

      {/* Action 2: Look at Terminal Display */}
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px 20px',
          textAlign: 'left',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--status-idle)', marginBottom: '4px' }}>
          [2] 👉 INSPECT 5-INCH TERMINAL DISPLAY
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
          Live 4-phase telemetry is streaming directly on the kiosk chassis screen. Once connected, your live shop QR code will appear on the display.
        </p>
      </div>

      {/* Action 3: Reconnect via Live QR */}
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
          [3] RECONNECT VIA LIVE TERMINAL QR
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
          Scan the live customer upload QR code on the kiosk screen with your phone camera to start printing and managing your terminal.
        </p>
      </div>
    </div>
  );
}

