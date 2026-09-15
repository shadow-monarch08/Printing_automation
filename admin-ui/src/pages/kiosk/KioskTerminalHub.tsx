import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../services/api';
import { Button } from '../../components/shared/Button';
import { LoadingNet } from '../../components/shared/LoadingNet';
import type { KioskSummaryData, ProvisioningTelemetry } from '../../types';
import { Globe, Wifi, Printer, Shield, RefreshCw } from 'lucide-react';

export function KioskTerminalHub() {
  const [summary, setSummary] = useState<KioskSummaryData | null>(null);
  const [telemetry, setTelemetry] = useState<ProvisioningTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [burnInOffset, setBurnInOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Fetch Kiosk Chassis Summary
  const fetchSummary = useCallback(async () => {
    try {
      const data = await api.getKioskSummary();
      setSummary(data);
      if (data.provisioning) {
        setTelemetry(data.provisioning);
      }
    } catch (err) {
      console.warn('[Terminal Hub] Error querying kiosk summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 5000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  // 2. Server-Sent Events (SSE) stream for zero-latency telemetry during setup
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/setup/provision-stream');
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.status) {
            setTelemetry(parsed);
            if (parsed.status === 'success') {
              fetchSummary();
            }
          }
        } catch {
          /* ignore heartbeat */
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
        }
      };
    } catch (sseErr) {
      console.warn('[Terminal Hub] SSE stream not supported or blocked:', sseErr);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [fetchSummary]);

  // 3. LCD Burn-in Protection: Subtle 2px pixel shift every 15 minutes
  useEffect(() => {
    const offsets = [
      { x: 0, y: 0 },
      { x: 2, y: 1 },
      { x: -1, y: 2 },
      { x: 1, y: -2 },
      { x: -2, y: -1 },
    ];
    let index = 0;

    const shiftInterval = setInterval(() => {
      index = (index + 1) % offsets.length;
      setBurnInOffset(offsets[index]);
    }, 15 * 60 * 1000);

    return () => clearInterval(shiftInterval);
  }, []);

  // Loading Screen using Primitive Custom Component
  if (loading && !summary) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LoadingNet message="INITIALIZING_TERMINAL_SUBSYSTEMS..." />
      </div>
    );
  }

  const isOnboarded = summary?.isOnboarded ?? false;
  const isProvisioning = telemetry && telemetry.status !== 'idle' && telemetry.status !== 'success';
  const isFailed = telemetry?.status === 'failed';

  // Dynamic QR Code Target URL for Live State (Offline Fallback check)
  const isOnline = summary?.internetOnline ?? false;
  const cloudflareUrl = summary?.cloudflareUrl;
  const localUrl = summary?.localAccessUrl || 'http://127.0.0.1:3000';
  const liveQrTarget = isOnline && cloudflareUrl ? cloudflareUrl : localUrl;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        transform: `translate(${burnInOffset.x}px, ${burnInOffset.y}px)`,
        transition: 'transform 1s ease-in-out',
        userSelect: 'none',
      }}
    >
      {/* Top Telemetry Header Bar */}
      <div
        style={{
          height: '42px',
          background: 'var(--bg-surface)',
          borderBottom: '2px solid var(--border-default)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={`led-diode ${isOnboarded ? 'green' : 'amber'}`} />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em' }}>
            PRINT_TERMINAL // [{summary?.shopName?.toUpperCase() || 'MODERN PRESS'}]
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <span>MODE: {isOnboarded ? 'OPERATIONAL' : 'FIRST_BOOT'}</span>
          <span>DISP: 800x480</span>
        </div>
      </div>

      {/* Main Screen Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '16px', gap: '16px' }}>

        {/* ======================================================================= */}
        {/* SCENARIO 1: UNPROVISIONED STATE (First Boot / Hotspot Active)          */}
        {/* ======================================================================= */}
        {!isOnboarded && !isProvisioning && (
          <>
            {/* Left: Setup QR Box */}
            <div
              style={{
                width: '320px',
                background: 'var(--bg-surface)',
                border: '2px solid var(--border-default)',
                borderRadius: 'var(--radius-lg, 8px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px',
                gap: '12px',
              }}
            >
              <div style={{ background: '#ffffff', padding: '12px', borderRadius: 'var(--radius-md, 6px)' }}>
                <QRCodeSVG
                  value={summary?.setupUrl || 'http://192.168.4.1:3000/setup'}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textAlign: 'center', letterSpacing: '0.05em' }}>
                [ SCAN WITH PHONE TO CONFIGURE ]
              </div>
            </div>

            {/* Right: Setup Instructions */}
            <div
              style={{
                flex: 1,
                background: 'var(--bg-surface)',
                border: '2px solid var(--border-default)',
                borderRadius: 'var(--radius-lg, 8px)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                  <Wifi size={18} />
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>AWAITING_PROVISIONING</span>
                </div>

                <div style={{ fontSize: '12px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                  <p style={{ margin: '0 0 8px 0' }}>
                    1. Connect your smartphone to setup Wi-Fi:
                    <br />
                    <strong style={{ color: 'var(--accent-secondary)', fontSize: '14px' }}>
                      SSID: {summary?.hotspotSsid || 'Kiosk-Hotspot'}
                    </strong>
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    2. Scan the QR code or browse to:
                    <br />
                    <strong style={{ color: 'var(--accent-secondary)' }}>
                      {summary?.setupUrl || 'http://192.168.4.1:3000/setup'}
                    </strong>
                  </p>
                  <p style={{ margin: 0 }}>
                    3. Submit shop identity & router Wi-Fi key.
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px dashed var(--border-default)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>STATUS: Hardware broadcast online. Radio ready for incoming credentials.</span>
                <Button
                  variant="ghost"
                  onClick={fetchSummary}
                  leftIcon={<RefreshCw size={12} />}
                  style={{
                    height: '28px',
                    fontSize: '10px',
                    padding: '0 8px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  REFRESH
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ======================================================================= */}
        {/* SCENARIO 2: PROVISIONING ACTIVE / FAILURE HAZARD OVERLAY                 */}
        {/* ======================================================================= */}
        {isProvisioning && (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--bg-surface)',
              border: isFailed ? '2px solid var(--status-error)' : '2px solid var(--accent-primary)',
              borderRadius: 'var(--radius-lg, 8px)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Header Status */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span className={`led-diode ${isFailed ? 'amber' : 'amber'}`} style={{ width: '14px', height: '14px' }} />
                <span style={{ fontSize: '16px', fontWeight: 700, color: isFailed ? 'var(--status-error)' : 'var(--accent-primary)' }}>
                  {isFailed ? '[ PROVISIONING_FAILED: HARDWARE_ROLLBACK ]' : `[ PROVISIONING_IN_PROGRESS // STEP 0${telemetry?.step || 1}/04 ]`}
                </span>
              </div>

              {/* Progress Bar (if not failed) */}
              {!isFailed ? (
                <div
                  style={{
                    width: '100%',
                    height: '14px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm, 4px)',
                    overflow: 'hidden',
                    margin: '16px 0',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${telemetry?.progressPercent || 25}%`,
                      background: 'var(--status-idle)',
                      transition: 'width 0.4s ease-in-out',
                    }}
                  />
                </div>
              ) : null}

              {/* Message Details */}
              <div
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md, 6px)',
                  padding: '16px',
                  marginTop: isFailed ? '12px' : '0',
                }}
              >
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  {telemetry?.message || 'Executing automated edge pipeline...'}
                </div>
                {telemetry?.ssid && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    TARGET_NETWORK: [{telemetry.ssid}]
                  </div>
                )}
                {isFailed && (
                  <div style={{ fontSize: '12px', color: 'var(--status-error)', marginTop: '8px', fontWeight: 700 }}>
                    ERROR_CODE: {telemetry?.code || 'AUTHENTICATION_TIMEOUT'}
                    <br />
                    REASON: {telemetry?.error || 'Invalid credentials or router out of range.'}
                  </div>
                )}
              </div>
            </div>

            {/* Failure Recovery Card with QR code */}
            {isFailed ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-primary)',
                  border: '1px dashed var(--status-error)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md, 6px)',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                  <strong>HOTSPOT RESTORED:</strong> Reconnect phone to <strong>Kiosk-Hotspot</strong> and retry.
                </div>
                <div style={{ background: '#fff', padding: '4px', borderRadius: 'var(--radius-sm, 4px)' }}>
                  <QRCodeSVG value={summary?.setupUrl || 'http://192.168.4.1:3000/setup'} size={64} level="L" />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Radio cycling in progress. Loopback interface 127.0.0.1 active and logging telemetry.
              </div>
            )}
          </div>
        )}

        {/* ======================================================================= */}
        {/* SCENARIO 3: LIVE OPERATIONAL TERMINAL HUB (isOnboarded === true)        */}
        {/* ======================================================================= */}
        {isOnboarded && !isProvisioning && (
          <>
            {/* Left Column: Giant Customer QR Code */}
            <div
              style={{
                width: '340px',
                background: 'var(--bg-surface)',
                border: '2px solid var(--border-default)',
                borderRadius: 'var(--radius-lg, 8px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px',
                gap: '12px',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  padding: '14px',
                  borderRadius: 'var(--radius-lg, 8px)',
                  boxShadow: 'var(--shadow-paper)',
                }}
              >
                <QRCodeSVG
                  value={liveQrTarget}
                  size={210}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-sm, 4px)',
                    background: isOnline ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 170, 0, 0.12)',
                    border: `1px solid ${isOnline ? 'var(--status-idle)' : 'var(--status-busy)'}`,
                    color: isOnline ? 'var(--status-idle)' : 'var(--status-busy)',
                    display: 'inline-block',
                    letterSpacing: '0.04em',
                  }}
                >
                  {isOnline ? '[ SCAN TO PRINT // CUSTOMER ACCESS ]' : '[ LOCAL WI-FI PRINTING ACTIVE ]'}
                </div>
              </div>
            </div>

            {/* Right Column: Machine Telemetry */}
            <div
              style={{
                flex: 1,
                background: 'var(--bg-surface)',
                border: '2px solid var(--border-default)',
                borderRadius: 'var(--radius-lg, 8px)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {/* Telemetry Stack */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Edge Status */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '12px',
                    borderBottom: '1px solid var(--border-default)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe size={16} color="var(--accent-secondary)" />
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>CLOUDFLARE_EDGE</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`led-diode ${isOnline ? 'green' : 'amber'}`} />
                    <span style={{ fontSize: '11px', color: isOnline ? 'var(--status-idle)' : 'var(--status-busy)', fontWeight: 700 }}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>

                {/* Local Network */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '12px',
                    borderBottom: '1px solid var(--border-default)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wifi size={16} color="var(--text-secondary)" />
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>LAN_GATEWAY</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                    {summary?.localAccessUrl ? summary.localAccessUrl.replace('http://', '') : '127.0.0.1:3000'}
                  </span>
                </div>

                {/* Active Link Profile */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '12px',
                    borderBottom: '1px solid var(--border-default)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} color="var(--text-secondary)" />
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>LINK_PROFILE</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {summary?.activeProfile || 'ETHERNET / DEFAULT'}
                  </span>
                </div>

                {/* Hardware Fleet */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '12px',
                    borderBottom: '1px solid var(--border-default)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Printer size={16} color="var(--status-idle)" />
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>CUPS_FLEET</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-idle)' }}>
                    ● {summary?.printerCount ?? 0} ENGINES READY
                  </span>
                </div>
              </div>

              {/* Bottom Touch Controls: Clean Tactile Refresh Button */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <Button
                  variant="ghost"
                  onClick={fetchSummary}
                  leftIcon={<RefreshCw size={14} />}
                  style={{
                    width: '100%',
                    height: '44px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md, 4px)',
                    color: 'var(--text-primary)',
                  }}
                >
                  [ REFRESH CHASSIS TELEMETRY ]
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default KioskTerminalHub;
