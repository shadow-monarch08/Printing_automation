// src/components/kiosk/onboarding/KioskWifiStep.tsx
import React, { useEffect, useState } from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { RefreshCw, ChevronLeft, Cable, Wifi } from 'lucide-react';
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

  // Viewport adaptation: If active plate is displayed, show 3 items per page; else show 4 items per page
  const itemsPerPage = activeNetworks.length > 0 ? 3 : 4;

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
        justifyContent: 'space-between',
        padding: '10px 20px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono, monospace)',
      }}
    >
      {/* 1. TOP TELEMETRY HEADER BAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '8px',
          borderBottom: '1px dashed var(--border-default, rgba(255, 255, 255, 0.15))',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setStep('IDENTITY')}
            style={{
              height: '34px',
              padding: '0 10px',
              background: '#24282D',
              border: '1.5px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '6px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Refresh Scan Button */}
          <button
            type="button"
            onClick={scanNetworks}
            disabled={isScanning}
            style={{
              height: '34px',
              padding: '0 12px',
              background: '#24282D',
              border: '1.5px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '6px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'none',
              fontFamily: 'var(--font-mono, monospace)',
              opacity: isScanning ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} className={isScanning ? 'spin' : ''} />
            <span>{isScanning ? '[ SWEEPING... ]' : '[ REFRESH SCAN ]'}</span>
          </button>

          {/* Wired Ethernet Bypass Button */}
          <button
            type="button"
            onClick={skipWifiAndProvision}
            style={{
              height: '34px',
              padding: '0 12px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1.5px solid #10B981',
              borderRadius: '6px',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'none',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            <Cable size={14} />
            <span>[ ETHERNET CABLE ]</span>
          </button>
        </div>
      </div>

      {/* 2. CURRENTLY CONNECTED ACTIVE LINK PLATE */}
      {activeNetworks.length > 0 && (
        <div
          onClick={() => handleSelectNetwork(activeNetworks[0])}
          style={{
            background: 'rgba(0, 200, 83, 0.08)',
            border: '2px solid var(--status-idle, #10B981)',
            borderRadius: '6px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '6px 0 2px 0',
            flexShrink: 0,
            boxSizing: 'border-box',
            cursor: 'none',
            transition: 'background 0.1s ease',
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.background = 'rgba(0, 200, 83, 0.18)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.background = 'rgba(0, 200, 83, 0.08)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10B981',
                boxShadow: '0 0 8px #10B981',
                display: 'inline-block',
              }}
            />
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                }}
              >
                {activeNetworks[0].ssid}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.65)',
                }}
              >
                ACTIVE LINK // {activeNetworks[0].signal}%
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '11px',
                color: 'var(--accent-secondary, #FF5500)',
              }}
            >
              {renderSignalGauge(activeNetworks[0].signal)}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '9px',
                padding: '2px 8px',
                background: 'var(--status-idle, #10B981)',
                color: '#000000',
                fontWeight: 800,
                borderRadius: '3px',
                letterSpacing: '0.04em',
              }}
            >
              [ACTIVE_LINK]
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '10px',
                fontWeight: 700,
                color: '#000000',
                background: '#10B981',
                border: '1px solid #10B981',
                borderRadius: '4px',
                padding: '4px 8px',
              }}
            >
              [ USE THIS ➔ ]
            </span>
          </div>
        </div>
      )}

      {/* 3. IN-HOUSE PAPERTABLE MATRIX (Zero-Scroll Viewport Fitted) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <PaperTable
          data={availableNetworks}
          itemsPerPage={itemsPerPage}
          pagination={true}
          showRecordCount={true}
          showPageSizeSelector={false}
          contentStyle={{ padding: '6px 8px', overflowY: 'hidden' }}
          paginationStyle={{ padding: '6px 14px', minHeight: '36px' }}
          style={{
            margin: '4px 0',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderTop: '1px dashed var(--border-default, rgba(255, 255, 255, 0.15))',
          }}
          renderData={(paginatedData) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {isScanning && networks.length === 0 ? (
                <div
                  style={{
                    padding: '28px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}
                >
                  <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  SWEEPING 2.4GHz / 5GHz FREQUENCIES...
                </div>
              ) : availableNetworks.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.6)',
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
                        height: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 12px',
                        background: '#22262B',
                        border: '1.5px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        cursor: 'none',
                        boxSizing: 'border-box',
                        transition: 'background 0.1s ease',
                      }}
                      onPointerDown={(e) => {
                        e.currentTarget.style.borderColor = '#FF5500';
                        e.currentTarget.style.background = '#2C3036';
                      }}
                      onPointerUp={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.background = '#22262B';
                      }}
                    >
                      {/* Left: Amber diode + SSID + Saved profile badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#F59E0B',
                            boxShadow: '0 0 6px rgba(245, 158, 11, 0.6)',
                            flexShrink: 0,
                          }}
                        />

                        <span
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {net.ssid}
                        </span>

                        {net.isSaved && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '9px',
                              padding: '1px 6px',
                              background: 'rgba(0, 200, 83, 0.15)',
                              border: '1px solid #10B981',
                              color: '#10B981',
                              fontWeight: 700,
                              flexShrink: 0,
                              borderRadius: '2px',
                            }}
                          >
                            [SAVED_PROFILE]
                          </span>
                        )}

                        {!isSecured && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '9px',
                              padding: '1px 5px',
                              background: 'rgba(16, 185, 129, 0.12)',
                              border: '1px solid #10B981',
                              color: '#10B981',
                              fontWeight: 700,
                              flexShrink: 0,
                              borderRadius: '2px',
                            }}
                          >
                            [OPEN]
                          </span>
                        )}
                      </div>

                      {/* Right: Signal gauge + Select Action */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '11px',
                            color: 'var(--accent-secondary, #FF5500)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {renderSignalGauge(net.signal)}
                        </span>

                        <span
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            background: '#2E3339',
                            border: '1px solid rgba(255, 255, 255, 0.18)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                          }}
                        >
                          [ SELECT ➔ ]
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        />

        {kioskSummary?.provisioningState === 'RECOVERY' && (
          <button
            type="button"
            onClick={skipWifiAndProvision}
            style={{
              width: '100%',
              height: '36px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              marginTop: '4px',
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
              padding: '20px 24px',
              width: '100%',
              maxWidth: '540px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Wifi size={20} color="#FF5500" />
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                }}
              >
                CONNECT_TO: [{savedChoiceModalNetwork.ssid}]
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.75)', margin: 0, lineHeight: 1.4 }}>
              This network profile is already saved in the system. Would you like to connect using the saved credentials, or enter a new password?
            </p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <TouchKey
                label="Use Saved Password"
                variant="action"
                height="46px"
                flex={2}
                onClick={() => {
                  setSavedChoiceModalNetwork(null);
                  setWifiPassword('');
                  submitProvisioning({ isSaved: true, password: '' });
                }}
              />
              <TouchKey
                label="Enter New Password"
                variant="secondary"
                height="46px"
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
                height="46px"
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
