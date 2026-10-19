import React, { useState } from 'react';
import { Button } from '../shared/Button';
import { ValidatedInput } from '../shared/ValidatedInput';
import { useOnboardingStore } from '../../stores/useOnboardingStore';

interface WifiConnectModalBodyProps {
  ssid?: string;
  isSaved?: boolean;
  closeModal: () => void;
  onSubmit?: (password: string, isSaved: boolean) => void;
}

export function WifiConnectModalBody({
  ssid: propSsid,
  isSaved: propIsSaved,
  closeModal,
  onSubmit: propOnSubmit,
}: WifiConnectModalBodyProps) {
  const selectedNetwork = useOnboardingStore((s) => s.selectedNetwork);
  const isSubmitting = useOnboardingStore((s) => s.isSubmitting);
  const submissionError = useOnboardingStore((s) => s.submissionError);
  const submitWifiProvision = useOnboardingStore((s) => s.submitWifiProvision);
  const clearSubmissionError = useOnboardingStore((s) => s.clearSubmissionError);

  const targetSsid = propSsid || selectedNetwork?.ssid || 'UNKNOWN_SSID';
  const targetIsSaved = propIsSaved ?? selectedNetwork?.isSaved ?? false;

  const [password, setPassword] = useState('');
  const [overridePassword, setOverridePassword] = useState(false);

  const handlePasswordChange = (val: string) => {
    if (submissionError) {
      clearSubmissionError();
    }
    setPassword(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const isUsingSaved = targetIsSaved && !overridePassword;
    const pwdToSend = isUsingSaved ? '' : password;

    // If legacy callback prop provided, invoke it
    if (propOnSubmit) {
      propOnSubmit(pwdToSend, isUsingSaved);
    }

    // Dispatch via transactional OnboardingStore
    const success = await submitWifiProvision({
      password: pwdToSend,
      isSaved: isUsingSaved,
      profileName: selectedNetwork?.profileName || undefined,
      uuid: selectedNetwork?.uuid || undefined,
    });

    if (success) {
      closeModal();
    }
  };

  const showPasswordInput = !targetIsSaved || overridePassword;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-secondary)' }}>
        TARGET_NETWORK: [{targetSsid}]
      </div>

      {/* Submission Error Banner */}
      {submissionError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1.5px solid #EF4444',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#EF4444', lineHeight: 1.4 }}>
            {submissionError}
          </div>
        </div>
      )}

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
              {targetIsSaved ? '[NEW_WPA2_PASSPHRASE]' : '[WPA2_PASSPHRASE]'}
            </label>
          </div>
          <ValidatedInput
            type="password"
            value={password}
            onChange={handlePasswordChange}
            disabled={isSubmitting}
            placeholder={targetIsSaved ? "Enter new Wi-Fi password..." : "Leave blank if open network..."}
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
            This network profile is saved in the system. Tap Connect to link immediately, or select Re-enter to provide a new passphrase.
          </p>
        </div>
      )}

      {/* Dynamic Action Buttons with Built-in Loading Feedback */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px', flexWrap: 'wrap' }}>
        {!targetIsSaved ? (
          <>
            <Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>
              [ ABORT / CANCEL ]
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
              [ JOIN NETWORK ➔ ]
            </Button>
          </>
        ) : !overridePassword ? (
          <>
            <Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>
              [ CANCEL ]
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => {
                clearSubmissionError();
                setOverridePassword(true);
              }}
            >
              [ 🔑 RE-ENTER ]
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
              [ CONNECT (SAVED) ➔ ]
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => {
                clearSubmissionError();
                setOverridePassword(false);
                setPassword('');
              }}
            >
              [ CANCEL / USE SAVED ]
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting || !password.trim()}
            >
              [ UPDATE & CONNECT ➔ ]
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
