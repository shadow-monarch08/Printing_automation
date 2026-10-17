import React, { useState } from 'react';
import { Button } from '../shared/Button';
import { ValidatedInput } from '../shared/ValidatedInput';

interface WifiConnectModalBodyProps {
  ssid: string;
  isSaved?: boolean;
  closeModal: () => void;
  onSubmit: (password: string) => void;
}

export function WifiConnectModalBody({ ssid, isSaved, closeModal, onSubmit }: WifiConnectModalBodyProps) {
  const [password, setPassword] = useState('');
  const [overridePassword, setOverridePassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
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
              [WPA2_PASSPHRASE]
            </label>
            {isSaved && (
              <button
                type="button"
                onClick={() => {
                  setOverridePassword(false);
                  setPassword('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted, #888)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Use saved credentials
              </button>
            )}
          </div>
          <ValidatedInput
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={isSaved ? "Enter new Wi-Fi password..." : "Leave blank if open network..."}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Profile is saved. You can connect directly without entering a password.
          </p>
          <div>
            <button
              type="button"
              onClick={() => setOverridePassword(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--accent-primary, #00ffff)',
                textDecoration: 'underline',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              🔑 Enter password manually instead
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <Button type="button" variant="ghost" onClick={closeModal}>
          [ ABORT / CANCEL ]
        </Button>
        <Button type="submit" variant="primary">
          [ JOIN NETWORK ➔ ]
        </Button>
      </div>
    </form>
  );
}
