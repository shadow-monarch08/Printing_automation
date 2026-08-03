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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password);
    closeModal();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-secondary)' }}>
        TARGET_NETWORK: [{ssid}]
      </div>
      {!isSaved ? (
        <div>
          <label
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '6px',
              display: 'block',
            }}
          >
            [WPA2_PASSPHRASE]
          </label>
          <ValidatedInput
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Leave blank if open network..."
          />
        </div>
      ) : (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
          Profile is saved. You can connect directly without entering a password.
        </p>
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
