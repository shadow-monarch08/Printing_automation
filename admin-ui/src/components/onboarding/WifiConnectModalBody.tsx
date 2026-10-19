import React, { useState } from 'react';
import { Button } from '../shared/Button';
import { ValidatedInput } from '../shared/ValidatedInput';

interface WifiConnectModalBodyProps {
  ssid: string;
  isSaved?: boolean;
  closeModal: () => void;
  onSubmit: (password: string, isSaved: boolean) => void;
}

export function WifiConnectModalBody({ ssid, isSaved, closeModal, onSubmit }: WifiConnectModalBodyProps) {
  const [password, setPassword] = useState('');
  const [overridePassword, setOverridePassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaved && !overridePassword) {
      onSubmit('', true);
    } else {
      onSubmit(password, false);
    }
    closeModal();
  };

  const showPasswordInput = !isSaved || overridePassword;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-secondary)' }}>
        TARGET_NETWORK: [{ssid}]
      </div>

      {showPasswordInput ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: 0,
              }}
            >
              {isSaved ? '[NEW_WPA2_PASSPHRASE]' : '[WPA2_PASSPHRASE]'}
            </label>
          </div>
          <ValidatedInput
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={isSaved ? "Enter new Wi-Fi password..." : "Leave blank if open network..."}
          />
        </div>
      ) : (
        <div
          style={{
            background: 'var(--bg-primary)',
            border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="led-diode green" style={{ width: '8px', height: '8px' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--status-idle)' }}>
              [SAVED_PROFILE_DETECTED]
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            This network profile is saved in the system. Tap Connect to link immediately, or select Update Password to provide a new passphrase.
          </p>
        </div>
      )}

      {/* Dynamic Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
        {!isSaved ? (
          <>
            <Button type="button" variant="ghost" onClick={closeModal}>
              [ ABORT / CANCEL ]
            </Button>
            <Button type="submit" variant="primary">
              [ JOIN NETWORK ➔ ]
            </Button>
          </>
        ) : !overridePassword ? (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOverridePassword(true)}
            >
              [ 🔑 RE-ENTER ]
            </Button>
            <Button type="submit" variant="primary">
              [ CONNECT (SAVED) ➔ ]
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOverridePassword(false);
                setPassword('');
              }}
            >
              [ CANCEL / USE SAVED ]
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!password.trim()}
            >
              [ UPDATE & CONNECT ➔ ]
            </Button>
          </>
        )}
      </div>
    </form>
  );
}

