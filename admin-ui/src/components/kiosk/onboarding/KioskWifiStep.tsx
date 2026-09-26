// src/components/kiosk/onboarding/KioskWifiStep.tsx
import React, { useEffect, useState } from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { Wifi, RefreshCw, ChevronLeft, ChevronUp, ChevronDown, Lock, Unlock, Network } from 'lucide-react';
import { TouchKey } from '../keyboard/TouchKey';
import type { WifiNetwork } from '../../../types';

const ITEMS_PER_PAGE = 3;

export const KioskWifiStep: React.FC = () => {
  const {
    networks,
    isScanning,
    scanNetworks,
    setStep,
    setSelectedNetwork,
    setWifiPassword,
    submitProvisioning,
    skipWifiAndProvision,
    openKeyboard,
  } = useKioskStore();

  const [page, setPage] = useState(0);

  useEffect(() => {
    scanNetworks();
  }, [scanNetworks]);

  const totalPages = Math.max(1, Math.ceil(networks.length / ITEMS_PER_PAGE));
  const currentPageNetworks = networks.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const handleSelectNetwork = (network: WifiNetwork) => {
    setSelectedNetwork(network);

    const isSecured = network.isSecured ?? (network.securityType ? !network.securityType.includes('OPEN') : true);

    if (!isSecured) {
      // Open network: connect directly without password prompt
      setWifiPassword('');
      submitProvisioning();
    } else {
      // Secured network: open virtual keyboard
      openKeyboard({
        mode: 'alpha',
        label: `PASS FOR: [${network.ssid.substring(0, 16)}]`,
        initialValue: '',
        isPassword: true,
        onSubmit: (password) => {
          setWifiPassword(password);
          submitProvisioning();
        },
      });
    }
  };

  const renderSignalGauge = (signal: number) => {
    const blocks = Math.min(4, Math.max(1, Math.ceil(signal / 25)));
    const filled = '█'.repeat(blocks);
    const empty = '░'.repeat(4 - blocks);
    return `[${filled}${empty}] ${signal}%`;
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px 18px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* 1. TOP BAR WITH CONTROLS */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setStep('IDENTITY')}
            style={{
              height: '36px',
              padding: '0 10px',
              background: 'var(--bg-surface, #24282D)',
              border: '1px solid var(--border-default, #3A4047)',
              borderRadius: 'var(--radius-sm, 4px)',
              color: 'var(--text-secondary, #9098A2)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'none',
            }}
          >
            <ChevronLeft size={16} />
            <span>BACK</span>
          </button>

          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
            }}
          >
            STEP 02/02 // NETWORK PROVISIONING
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Re-Scan Button */}
          <button
            type="button"
            onClick={scanNetworks}
            disabled={isScanning}
            style={{
              height: '36px',
              padding: '0 12px',
              background: 'var(--bg-surface, #24282D)',
              border: '1px solid var(--accent-primary, #FF5500)',
              borderRadius: 'var(--radius-sm, 4px)',
              color: 'var(--accent-primary, #FF5500)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'none',
              opacity: isScanning ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} className={isScanning ? 'spin' : ''} />
            <span>{isScanning ? 'SCANNING...' : 'RE-SCAN'}</span>
          </button>

          {/* Wired Ethernet Bypass Button */}
          <button
            type="button"
            onClick={skipWifiAndProvision}
            style={{
              height: '36px',
              padding: '0 12px',
              background: 'var(--bg-surface, #24282D)',
              border: '1px solid var(--border-default, #3A4047)',
              borderRadius: 'var(--radius-sm, 4px)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'none',
            }}
          >
            <Network size={14} />
            <span>USE WIRED ETHERNET (SKIP)</span>
          </button>
        </div>
      </div>

      {/* 2. NETWORK CARDS LIST / SCANNING STATE */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
        {isScanning && networks.length === 0 ? (
          <div
            style={{
              background: 'var(--bg-surface, #24282D)',
              border: '1.5px dashed var(--border-default, #3A4047)',
              borderRadius: 'var(--radius-md, 6px)',
              padding: '30px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <RefreshCw size={28} color="var(--accent-primary, #FF5500)" className="spin" />
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              SCANNING 2.4GHz & 5GHz FREQUENCIES...
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              Hardware radio cycling channels. Please ensure shop router is within range.
            </div>
          </div>
        ) : networks.length === 0 ? (
          <div
            style={{
              background: 'var(--bg-surface, #24282D)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md, 6px)',
              padding: '24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              NO WI-FI ACCESS POINTS DETECTED
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <TouchKey label="RE-SCAN AIRWAVES" height="42px" minWidth="180px" onClick={scanNetworks} />
              <TouchKey
                label="USE WIRED LAN INSTEAD"
                variant="action"
                height="42px"
                minWidth="220px"
                onClick={skipWifiAndProvision}
              />
            </div>
          </div>
        ) : (
          currentPageNetworks.map((net) => {
            const isSecured = net.isSecured ?? (net.securityType ? !net.securityType.includes('OPEN') : true);
            return (
              <div
                key={net.ssid}
                onClick={() => handleSelectNetwork(net)}
                style={{
                  height: '56px',
                  background: 'var(--bg-surface, #24282D)',
                  border: '1.5px solid var(--border-default, #3A4047)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 3px 0 #000000',
                  cursor: 'none',
                  boxSizing: 'border-box',
                }}
                onPointerDown={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary, #FF5500)';
                  e.currentTarget.style.transform = 'translateY(1px)';
                }}
                onPointerUp={(e) => {
                  e.currentTarget.style.transform = 'none';
                }}
                onPointerLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default, #3A4047)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {/* SSID & Type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Wifi size={20} color="var(--accent-primary, #FF5500)" />
                  <div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {net.ssid}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {isSecured ? (
                        <>
                          <Lock size={10} color="#F59E0B" />
                          <span>{net.securityType || 'WPA2/WPA3'}</span>
                        </>
                      ) : (
                        <>
                          <Unlock size={10} color="#10B981" />
                          <span style={{ color: '#10B981' }}>OPEN / NO PASSWORD</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Signal Gauge & Connect Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--accent-secondary, #00A396)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {renderSignalGauge(net.signal)}
                  </span>

                  <button
                    type="button"
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      background: 'var(--accent-primary, #FF5500)',
                      border: '1px solid #E04B00',
                      borderRadius: '2px',
                      color: '#1A1D20',
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      cursor: 'none',
                    }}
                  >
                    CONNECT →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. PAGING CONTROLS & STATUS */}
      {networks.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px dashed var(--border-default, #3A4047)',
          }}
        >
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            DETECTED: [{networks.length} APs] // PAGE [{page + 1}/{totalPages}]
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              style={{
                height: '34px',
                padding: '0 14px',
                background: 'var(--bg-surface, #24282D)',
                border: '1px solid var(--border-default)',
                borderRadius: '2px',
                color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                cursor: 'none',
              }}
            >
              <ChevronUp size={16} />
              <span>PREV</span>
            </button>

            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              style={{
                height: '34px',
                padding: '0 14px',
                background: 'var(--bg-surface, #24282D)',
                border: '1px solid var(--border-default)',
                borderRadius: '2px',
                color: page >= totalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                cursor: 'none',
              }}
            >
              <span>NEXT</span>
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
