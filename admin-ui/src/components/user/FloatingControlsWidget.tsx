import { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Volume2, VolumeX, GripVertical } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../shared/Button';
import { soundFx } from '../../utils/sound';

export function FloatingControlsWidget() {
  const { theme, toggleTheme } = useTheme();
  const [isMuted, setIsMuted] = useState(soundFx.getMuted());

  // Default floating position: bottom-left, above mobile action bar
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({
    mouseX: 0,
    mouseY: 0,
    posX: 16,
    posY: 0
  });

  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial position on screen mount
    const defaultY = Math.max(80, window.innerHeight - 140);
    setPosition({ x: 16, y: defaultY });
  }, []);

  const handleToggleMute = () => {
    const nextMuted = soundFx.toggleMute();
    setIsMuted(nextMuted);
  };

  // Mouse Dragging Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!position) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  // Touch Dragging Handlers (Mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!position || e.touches.length === 0) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      const newX = Math.max(8, Math.min(window.innerWidth - 120, dragStartRef.current.posX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 60, dragStartRef.current.posY + dy));

      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length === 0) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.mouseX;
      const dy = touch.clientY - dragStartRef.current.mouseY;

      const newX = Math.max(8, Math.min(window.innerWidth - 120, dragStartRef.current.posX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 60, dragStartRef.current.posY + dy));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleTouchEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  if (!position) return null;

  return (
    <div
      ref={widgetRef}
      className="floating-controls-widget"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: 'var(--bg-surface)',
        border: '1.5px solid var(--border-default)',
        borderRadius: '4px',
        boxShadow: 'var(--shadow-paper), 0 4px 16px rgba(0,0,0,0.3)',
        padding: '4px 6px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none'
      }}
    >
      {/* Drag Grip Handle */}
      <div 
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        title="Drag to reposition controls"
        style={{
          display: 'flex',
          alignItems: 'center',
          color: 'var(--text-secondary)',
          padding: '2px 0 2px 2px',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <GripVertical size={16} />
      </div>

      {/* Mute Audio Switch */}
      <Button 
        variant="ghost" 
        onClick={handleToggleMute} 
        aria-label="Toggle Mute"
        style={{ padding: '4px 6px', minHeight: '36px', minWidth: '36px', borderRadius: '2px' }}
      >
        {isMuted ? <VolumeX size={16} color="var(--status-error)" /> : <Volume2 size={16} />}
      </Button>

      {/* Theme Switcher */}
      <Button 
        variant="ghost" 
        onClick={toggleTheme} 
        aria-label="Toggle theme"
        style={{ padding: '4px 6px', minHeight: '36px', minWidth: '36px', borderRadius: '2px' }}
      >
        {theme === 'dark' ? <Sun size={16} color="var(--accent-primary)" /> : <Moon size={16} />}
      </Button>
    </div>
  );
}
