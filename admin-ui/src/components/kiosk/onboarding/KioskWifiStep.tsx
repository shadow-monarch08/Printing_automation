// src/components/kiosk/onboarding/KioskWifiStep.tsx
import React, { useEffect, useState } from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { RefreshCw, ChevronLeft, Wifi } from 'lucide-react';
import { PaperTable } from '../../shared/PaperTable';
import { TouchKey } from '../keyboard/TouchKey';
import type { WifiNetwork } from '../../../types';

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
    kioskSummary,
  } = useKioskStore();

  const [savedChoiceModalNetwork, setSavedChoiceModalNetwork] = useState<WifiNetwork | null>(null);

  useEffect(() => {
    scanNetworks();
  }, [scanNetworks]);

  const renderSignalGauge = (signal: number) => {
    const blocks = Math.min(4, Math.max(1, Math.ceil(signal / 25)));
    const filled = '█ '.repeat(blocks);
    const empty = '░ '.repeat(4 - blocks);
    return `[ ${filled}${empty}] ${signal}%`;
  };

  const activeNetworks = networks.filter((n) => n.isActive);
  const availableNetworks = networks.filter((n) => !n.isActive);

  // Viewport adaptation:
  // With Active Link plate: 2 spacious rows per page (total height ~302px out of 440px)
  // Without Active Link plate: 3 spacious rows per page (total height ~302px out of 440px)
  // This guarantees 100+ pixels of margin and mathematically ZERO scrolling!
  const itemsPerPage = activeNetworks.length > 0 ? 2 : 3;

  const handleSelectNetwork = (network: WifiNetwork) => {
    setSelectedNetwork(network);

    // 1. If saved profile exists, prompt user to use saved credentials or enter new
    if (network.isSaved) {
      setSavedChoiceModalNetwork(network);
      return;
    }

    // 2. Open / Unsecured Network
    const isSecured = network.isSecured ?? (network.securityType ? !network.securityType.includes('OPEN') : true);
    if (!isSecured) {
      setWifiPassword('');
      submitProvisioning({ isSaved: false, password: '' });
      return;
    }

    // 3. Secured Network: Open virtual keyboard
    openKeyboard({
      mode: 'alpha',
      label: `Password for "${network.ssid}"`,
      initialValue: '',
      isPassword: true,
      onSubmit: (password) => {
        setWifiPassword(password);
        submitProvisioning({ isSaved: false, password });
      },
    });
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        padding: '8px 16px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono, monospace)',
      }}
    >
      {/* 1. TOP TELEMETRY HEADER BAR (Clean, spacious, unsquished) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '8px',
          borderBottom: '1px dashed var(--border-default, rgba(255, 255, 255, 0.15))',
          flexShrink: 0,
          marginBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setStep('IDENTITY')}
            style={{
              height: '38px',
              padding: '0 14px',
              background: '#24282D',
              border: '1.5px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '6px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'none',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            <ChevronLeft size={16} />
            <span>[ BACK ]</span>
          </button>

          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-primary, #FFFFFF)',
              letterSpacing: '0.04em',
            }}
          >
            WI-FI_RADIO_PROVISIONING
          </span>
        </div>

        <button
          type="button"
          onClick={scanNetworks}
          disabled={isScanning}
          style={{
            height: '38px',
            padding: '0 16px',
            background: '#24282D',
            border: '1.5px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '6px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'none',
            fontFamily: 'var(--font-mono, monospace)',
            opacity: isScanning ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} className={isScanning ? 'spin' : ''} />
          <span>{isScanning ? '[ SWEEPING... ]' : '[ REFRESH SCAN ]'}</span>
        </button>
      </div>

      {/* 2. CURRENTLY CONNECTED ACTIVE LINK PLATE (One-Tap Continuation) */}
      {activeNetworks.length > 0 && (
        <div
          style={{
            background: 'rgba(0, 200, 83, 0.08)',
            border: '2px solid var(--status-idle, #10B981)',
            borderRadius: '8px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '6px 0 8px 0',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#10B981',
                boxShadow: '0 0 10px #10B981',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                }}
              >
                {activeNetworks[0].ssid}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginTop: '2px',
                }}
              >
                ACTIVE LINK // {renderSignalGauge(activeNetworks[0].signal)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '10px',
                padding: '3px 8px',
                background: 'rgba(0, 200, 83, 0.2)',
                border: '1px solid #10B981',
                color: '#10B981',
                fontWeight: 800,
                borderRadius: '3px',
                letterSpacing: '0.04em',
              }}
            >
              [ONLINE]
            </span>

            <button
              type="button"
              onClick={skipWifiAndProvision}
              style={{
                height: '38px',
                padding: '0 16px',
                background: '#10B981',
                border: 'none',
                borderRadius: '6px',
                color: '#000000',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'none',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.97)';
              }}
              onPointerUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span>[ USE ACTIVE CONNECTION ➔ ]</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. IN-HOUSE PAPERTABLE MATRIX (Spacious, Roomy, Zero-Scroll Viewport) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <PaperTable
          data={availableNetworks}
          itemsPerPage={itemsPerPage}
          pagination={true}
          showRecordCount={true}
          showPageSizeSelector={false}
          contentStyle={{ padding: '6px 8px', overflowY: 'hidden' }}
          paginationStyle={{ padding: '6px 14px', minHeight: '38px' }}
          style={{
            margin: '4px 0',
            borderTop: '1px dashed var(--border-default, rgba(255, 255, 255, 0.15))',
          }}
          renderData={(paginatedData) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isScanning && networks.length === 0 ? (
                <div
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.65)',
                  }}
                >
                  <RefreshCw size={22} className="spin" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                  SWEEPING 2.4GHz / 5GHz FREQUENCIES...
                </div>
              ) : availableNetworks.length === 0 ? (
                <div
                  style={{
                    padding: '28px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.65)',
                  }}
                >
                  NO ADDITIONAL ACCESS POINTS DETECTED.
                </div>
              ) : (
                paginatedData.map((net) => {
                  const isSecured = net.isSecured ?? (net.securityType ? !net.securityType.includes('OPEN') : true);
                  return (
                    <div
                      key={net.ssid}
                      onClick={() => handleSelectNetwork(net)}
                      style={{
                        height: '58px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 16px',
                        background: '#22262B',
                        border: '1.5px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        cursor: 'none',
                        boxSizing: 'border-box',
                        transition: 'background 0.15s ease, border-color 0.15s ease',
                      }}
                      onPointerDown={(e) => {
                        e.currentTarget.style.borderColor = '#FF5500';
                        e.currentTarget.style.background = '#2C3036';
                      }}
                      onPointerUp={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                        e.currentTarget.style.background = '#22262B';
                      }}
                    >
                      {/* Left: Amber glowing diode + SSID + Saved profile badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: '#F59E0B',
                            boxShadow: '0 0 8px rgba(245, 158, 11, 0.7)',
                            flexShrink: 0,
                          }}
                        />

                        <span
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '15px',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '300px',
                          }}
                        >
                          {net.ssid}
                        </span>

                        {net.isSaved && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '11px',
                              padding: '2px 8px',
                              background: 'rgba(0, 200, 83, 0.15)',
                              border: '1px solid #10B981',
                              color: '#10B981',
                              fontWeight: 700,
                              flexShrink: 0,
                              borderRadius: '4px',
                            }}
                          >
                            [SAVED_PROFILE]
                          </span>
                        )}

                        {!isSecured && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '11px',
                              padding: '2px 8px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid #10B981',
                              color: '#10B981',
                              fontWeight: 700,
                              flexShrink: 0,
                              borderRadius: '4px',
                            }}
                          >
                            [OPEN]
                          </span>
                        )}
                      </div>

                      {/* Right: Signal gauge + Select Action */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--accent-secondary, #FF5500)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {renderSignalGauge(net.signal)}
                        </span>

                        <span
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            background: '#2E3339',
                            border: '1.5px solid rgba(255, 255, 255, 0.22)',
                            borderRadius: '6px',
                            padding: '8px 14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          [ CONNECT ➔ ]
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        />

        {activeNetworks.length === 0 && kioskSummary?.provisioningState === 'RECOVERY' && (
          <button
            type="button"
            onClick={skipWifiAndProvision}
            style={{
              width: '100%',
              height: '38px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              marginTop: '6px',
              border: '1px dashed rgba(255, 255, 255, 0.25)',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '6px',
              cursor: 'none',
              flexShrink: 0,
            }}
          >
            [ PROCEED WITH CURRENT ACTIVE NETWORK (SKIP WI-FI SETUP) ➔ ]
          </button>
        )}
      </div>

      {/* 4. MODAL FOR SAVED PROFILE CHOICE */}
      {savedChoiceModalNetwork && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              background: '#22262B',
              border: '2px solid #FF5500',
              borderRadius: '8px',
              padding: '22px 24px',
              width: '100%',
              maxWidth: '560px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Wifi size={22} color="#FF5500" />
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                }}
              >
                SAVED_NETWORK: [{savedChoiceModalNetwork.ssid}]
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.75)', margin: 0, lineHeight: 1.5 }}>
              This network profile is saved in the system. Tap Connect to link immediately using saved credentials.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <TouchKey
                label="Connect with Saved Key ➔"
                variant="action"
                height="48px"
                flex={2.5}
                onClick={() => {
                  setSavedChoiceModalNetwork(null);
                  setWifiPassword('');
                  submitProvisioning({ isSaved: true, password: '' });
                }}
              />
              <TouchKey
                label="Enter New Password"
                variant="secondary"
                height="48px"
                flex={2}
                onClick={() => {
                  const net = savedChoiceModalNetwork;
                  setSavedChoiceModalNetwork(null);
                  openKeyboard({
                    mode: 'alpha',
                    label: `Password for "${net.ssid}"`,
                    initialValue: '',
                    isPassword: true,
                    onSubmit: (password) => {
                      setWifiPassword(password);
                      submitProvisioning({ isSaved: false, password });
                    },
                  });
                }}
              />
              <TouchKey
                label="Cancel"
                variant="danger"
                height="48px"
                flex={1}
                onClick={() => setSavedChoiceModalNetwork(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
