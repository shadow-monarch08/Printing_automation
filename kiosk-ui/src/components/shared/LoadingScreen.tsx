import { LoadingNet } from './LoadingNet';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({ message = 'Awaiting Telemetry...', fullScreen = false }: LoadingScreenProps) {
  const containerStyle: React.CSSProperties = fullScreen ? {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-primary)',
    zIndex: 9999,
  } : {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '3rem',
    minHeight: '200px'
  };

  return (
    <div style={containerStyle}>
      <LoadingNet message={message} />
    </div>
  );
}
