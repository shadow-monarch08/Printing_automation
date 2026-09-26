// src/components/kiosk/onboarding/KioskWifiStep.tsx
import React, { useEffect, useState } from 'react';
import { useKioskStore } from '../../../stores/useKioskStore';
import { Wifi, RefreshCw, ChevronLeft, ChevronUp, ChevronDown, Lock, Unlock, Cable } from 'lucide-react';
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
      setWifiPassword('');
      submitProvisioning();
    } else {
      openKeyboard({
        mode: 'alpha',
        label: `Password for "${network.ssid}"`,
        initialValue: '',
        isPassword: true,
        onSubmit: (password) => {
          setWifiPassword(password);
          submitProvisioning();
        },
      });
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      {/* 1. Header with Clean Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setStep('IDENTITY')}
            style={{
              height: '36px',
              padding: '0 12px',
              background: '#24282D',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'none',
            }}
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>

          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#FFFFFF',
              margin: 0,
            }}
          >
            Select Shop Wi-Fi
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Refresh Button */}
          <button
            type="button"
            onClick={scanNetworks}
            disabled={isScanning}
            style={{
              height: '36px',
              padding: '0 12px',
              background: '#24282D',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'none',
              opacity: isScanning ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} className={isScanning ? 'spin' : ''} />
            <span>{isScanning ? 'Searching...' : 'Refresh'}</span>
          </button>

          {/* Wired Ethernet Bypass Button */}
          <button
            type="button"
            onClick={skipWifiAndProvision}
            style={{
              height: '36px',
              padding: '0 14px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid #10B981',
              borderRadius: '6px',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'none',
            }}
          >
            <Cable size={14} />
            <span>Use Ethernet Cable</span>
          </button>
        </div>
      </div>

      {/* 2. Network Cards List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
        {isScanning && networks.length === 0 ? (
          <div
            style={{
              background: '#24282D',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <RefreshCw size={26} color="#FF5500" className="spin" />
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>
              Searching for Wi-Fi networks...
            </div>
          </div>
        ) : networks.length === 0 ? (
          <div
            style={{
              background: '#24282D',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>
              No Wi-Fi networks found nearby
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <TouchKey label="Search Again" height="42px" minWidth="150px" onClick={scanNetworks} />
              <TouchKey
                label="Use Ethernet Cable"
                variant="action"
                height="42px"
                minWidth="180px"
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
                  background: '#24282D',
                  border: '1.5px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '0 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                  cursor: 'none',
                  boxSizing: 'border-box',
                }}
                onPointerDown={(e) => {
                  e.currentTarget.style.borderColor = '#FF5500';
                  e.currentTarget.style.transform = 'translateY(1px)';
                }}
                onPointerUp={(e) => {
                  e.currentTarget.style.transform = 'none';
                }}
                onPointerLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {/* SSID & Security */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <Wifi size={20} color="#FF5500" />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>
                      {net.ssid}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255, 255, 255, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '2px',
                      }}
                    >
                      {isSecured ? (
                        <>
                          <Lock size={11} color="rgba(255, 255, 255, 0.5)" />
                          <span>Password Required</span>
                        </>
                      ) : (
                        <>
                          <Unlock size={11} color="#10B981" />
                          <span style={{ color: '#10B981' }}>Open Network</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Signal Gauge & Connect Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)' }}>
                    {net.signal}%
                  </span>

                  <button
                    type="button"
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      background: '#FF5500',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#1A1D20',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'none',
                    }}
                  >
                    Connect →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Paging Controls */}
      {networks.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
            Showing {page * ITEMS_PER_PAGE + 1}–{Math.min(networks.length, (page + 1) * ITEMS_PER_PAGE)} of {networks.length} networks
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              style={{
                height: '34px',
                padding: '0 14px',
                background: '#24282D',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: page === 0 ? 'rgba(255, 255, 255, 0.3)' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'none',
              }}
            >
              <ChevronUp size={16} />
              <span>Previous</span>
            </button>

            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              style={{
                height: '34px',
                padding: '0 14px',
                background: '#24282D',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: page >= totalPages - 1 ? 'rgba(255, 255, 255, 0.3)' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'none',
              }}
            >
              <span>Next</span>
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
