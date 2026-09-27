// src/components/kiosk/onboarding/KioskWifiStep.tsx
import React, { useEffect, useState } from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { RefreshCw, ChevronLeft, Wifi } from 'lucide-react';
import { PaperTable } from '../../shared/PaperTable';
import { Button } from '../../shared/Button';
import { SkeletonBox } from '../../shared/SkeletonPrimitives';
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
        padding: '10px 18px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono, monospace)',
        userSelect: 'none',
      }}
    >
      {/* 1. TOP HEADER (Big title, clean controls, no subtitles) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '8px',
          borderBottom: '1px dashed var(--border-default)',
          flexShrink: 0,
          marginBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            variant="ghost"
            leftIcon={<ChevronLeft size={16} />}
            onClick={() => setStep('IDENTITY')}
            style={{
              height: '38px',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            [ BACK ]
          </Button>

          <h1
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '20px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '0.03em',
            }}
          >
            SELECT WI-FI NETWORK
          </h1>
        </div>

        <Button
          variant="ghost"
          isLoading={isScanning}
          leftIcon={<RefreshCw size={14} className={isScanning ? 'spin' : ''} />}
          onClick={scanNetworks}
          style={{
            height: '38px',
            padding: '0 16px',
            fontSize: '12px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {isScanning ? '[ SWEEPING... ]' : '[ SCAN ]'}
        </Button>
      </div>

      {/* 2. CURRENTLY CONNECTED ACTIVE LINK PLATE (One-Tap Fast Continuation) */}
      {activeNetworks.length > 0 && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '2px solid var(--status-idle, #00FF88)',
            borderRadius: 'var(--radius-lg, 6px)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
            flexShrink: 0,
            boxShadow: 'var(--shadow-paper)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--status-idle, #00FF88)',
                boxShadow: '0 0 10px var(--status-idle, #00FF88)',
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.04em',
                }}
              >
                CURRENT ACTIVE CONNECTION
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.02em',
                }}
              >
                {activeNetworks[0].ssid}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '10px',
                padding: '3px 8px',
                background: 'rgba(0, 255, 136, 0.12)',
                border: '1px solid var(--status-idle, #00FF88)',
                color: 'var(--status-idle, #00FF88)',
                fontWeight: 800,
                borderRadius: 'var(--radius-sm, 2px)',
                letterSpacing: '0.04em',
              }}
            >
              [ONLINE]
            </span>

            <Button
              variant="primary"
              onClick={skipWifiAndProvision}
              style={{
                height: '38px',
                padding: '0 16px',
                fontSize: '12px',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.04em',
              }}
            >
              [ USE ACTIVE CONNECTION ➔ ]
            </Button>
          </div>
        </div>
      )}

      {/* 3. AVAILABLE ACCESS POINTS TABLE WITH TARGETED LOADING SKELETON */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <PaperTable<WifiNetwork>
          data={availableNetworks}
          itemsPerPage={itemsPerPage}
          showRecordCount={false}
          showPageSizeSelector={false}
          style={{
            border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-lg, 6px)',
            background: 'var(--bg-primary)',
            boxShadow: 'var(--shadow-paper)',
          }}
          paginationStyle={{
            padding: '4px 14px',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
          }}
          renderData={(paginatedData) => (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '8px',
                boxSizing: 'border-box',
              }}
            >
              {isScanning && availableNetworks.length === 0 ? (
                /* Targeted Loading Skeletons: 2 Shimmering Rows */
                [0, 1].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      height: '62px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 16px',
                      background: 'var(--bg-surface)',
                      border: '1.5px solid var(--border-default)',
                      borderRadius: 'var(--radius-lg, 6px)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '55%' }}>
                      <SkeletonBox width="10px" height="10px" borderRadius="50%" />
                      <SkeletonBox width="70%" height="20px" borderRadius="4px" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <SkeletonBox width="85px" height="18px" borderRadius="4px" />
                      <SkeletonBox width="95px" height="38px" borderRadius="4px" />
                    </div>
                  </div>
                ))
              ) : availableNetworks.length === 0 ? (
                <div
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
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
                        height: '62px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 16px',
                        background: 'var(--bg-surface)',
                        border: '1.5px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg, 6px)',
                        cursor: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                      onPointerDown={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      }}
                      onPointerUp={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                      }}
                    >
                      {/* Left: Diode + SSID + Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: 'var(--accent-primary)',
                            boxShadow: '0 0 8px var(--accent-primary)',
                            flexShrink: 0,
                          }}
                        />

                        <span
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '16px',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
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
                              fontSize: '10px',
                              padding: '2px 6px',
                              background: 'rgba(0, 255, 136, 0.12)',
                              border: '1px solid var(--status-idle, #00FF88)',
                              color: 'var(--status-idle, #00FF88)',
                              fontWeight: 800,
                              flexShrink: 0,
                              borderRadius: 'var(--radius-sm, 2px)',
                            }}
                          >
                            [SAVED]
                          </span>
                        )}

                        {!isSecured && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '10px',
                              padding: '2px 6px',
                              background: 'rgba(0, 255, 136, 0.12)',
                              border: '1px solid var(--status-idle, #00FF88)',
                              color: 'var(--status-idle, #00FF88)',
                              fontWeight: 800,
                              flexShrink: 0,
                              borderRadius: 'var(--radius-sm, 2px)',
                            }}
                          >
                            [OPEN]
                          </span>
                        )}
                      </div>

                      {/* Right: Signal gauge + Connect Button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--accent-primary)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {renderSignalGauge(net.signal)}
                        </span>

                        <Button
                          variant="mechanical"
                          style={{
                            height: '38px',
                            padding: '0 16px',
                            fontSize: '12px',
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono, monospace)',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectNetwork(net);
                          }}
                        >
                          CONNECT ➔
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        />

        {activeNetworks.length === 0 && kioskSummary?.provisioningState === 'RECOVERY' && (
          <Button
            variant="ghost"
            onClick={skipWifiAndProvision}
            style={{
              width: '100%',
              height: '38px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              marginTop: '6px',
              border: '1px dashed var(--border-default)',
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
          >
            [ PROCEED WITH CURRENT ACTIVE NETWORK (SKIP WI-FI SETUP) ➔ ]
          </Button>
        )}
      </div>

      {/* 4. MODAL FOR SAVED PROFILE CHOICE */}
      {savedChoiceModalNetwork && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--modal-backdrop, rgba(0, 0, 0, 0.75))',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '2px solid var(--accent-primary)',
              borderRadius: 'var(--radius-lg, 6px)',
              padding: '20px 24px',
              width: '100%',
              maxWidth: '540px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: 'var(--shadow-paper)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Wifi size={22} color="var(--accent-primary)" />
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '17px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                }}
              >
                SAVED_NETWORK: [{savedChoiceModalNetwork.ssid}]
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              This network profile is saved in the system. Tap Connect to link immediately using saved credentials.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <Button
                variant="primary"
                style={{ flex: 2.5, height: '46px', fontSize: '13px', fontWeight: 800 }}
                onClick={() => {
                  setSavedChoiceModalNetwork(null);
                  setWifiPassword('');
                  submitProvisioning({ isSaved: true, password: '' });
                }}
              >
                Connect with Saved Key ➔
              </Button>
              <Button
                variant="ghost"
                style={{ flex: 2, height: '46px', fontSize: '13px', fontWeight: 700 }}
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
              >
                Enter New Password
              </Button>
              <Button
                variant="danger"
                style={{ flex: 1, height: '46px', fontSize: '13px', fontWeight: 700 }}
                onClick={() => setSavedChoiceModalNetwork(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
