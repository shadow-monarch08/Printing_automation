import React, { useState, useRef, useEffect } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { soundFx } from '../../utils/sound';
import { useModal } from '../../context/ModalContext';
import { Button } from './Button';

dayjs.extend(isBetween);

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

// Mobile Modal Calendar Content Body Component
const MobileCalendarModalContent: React.FC<{
  initialStart: string;
  initialEnd: string;
  onApply: (start: string, end: string) => void;
  onClose: () => void;
}> = ({ initialStart, initialEnd, onApply, onClose }) => {
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [selStart, setSelStart] = useState<Dayjs | null>(dayjs(initialStart));
  const [selEnd, setSelEnd] = useState<Dayjs | null>(dayjs(initialEnd));
  const [viewMonth, setViewMonth] = useState<Dayjs>(dayjs(initialEnd).startOf('month'));
  const [hoverDate, setHoverDate] = useState<Dayjs | null>(null);

  const handlePreset = (days: number) => {
    soundFx.playClick();
    setActivePreset(days);
    const end = dayjs();
    const start = dayjs().subtract(days, 'day');
    setSelStart(start);
    setSelEnd(end);
    setViewMonth(end.startOf('month'));
  };

  const handleDayClick = (date: Dayjs) => {
    soundFx.playClick();
    setActivePreset(null);
    if (!selStart || (selStart && selEnd)) {
      setSelStart(date);
      setSelEnd(null);
    } else {
      if (date.isBefore(selStart)) {
        setSelEnd(selStart);
        setSelStart(date);
      } else {
        setSelEnd(date);
      }
    }
  };

  const isToday = (date: Dayjs) => date.isSame(dayjs(), 'day');
  const isSelected = (date: Dayjs) => (selStart && date.isSame(selStart, 'day')) || (selEnd && date.isSame(selEnd, 'day'));
  const isInRange = (date: Dayjs) => {
    if (selStart && selEnd) return date.isBetween(selStart, selEnd, 'day', '[]');
    if (selStart && hoverDate) {
      const start = selStart.isBefore(hoverDate) ? selStart : hoverDate;
      const end = selStart.isBefore(hoverDate) ? hoverDate : selStart;
      return date.isBetween(start, end, 'day', '[]');
    }
    return false;
  };

  const handleConfirmApply = () => {
    if (selStart && selEnd) {
      soundFx.playClick();
      onApply(selStart.format('YYYY-MM-DD'), selEnd.format('YYYY-MM-DD'));
      onClose();
    }
  };

  // Render Calendar Grid for single month in modal
  const startOfMonth = viewMonth.startOf('month');
  const startDay = startOfMonth.day();
  const daysInMonth = viewMonth.daysInMonth();
  const dayCells = [];

  for (let i = 0; i < startDay; i++) {
    dayCells.push(<div key={`m-empty-${i}`} className="date-picker-day empty" />);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const date = viewMonth.date(i);
    const selected = isSelected(date);
    const inRange = isInRange(date);
    const today = isToday(date);

    let cellStyle: React.CSSProperties = {
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      userSelect: 'none',
      borderRadius: selected ? '2px' : '0px',
      transition: 'all 0.15s ease',
    };

    if (selected) {
      cellStyle.backgroundColor = 'var(--accent-primary)';
      cellStyle.color = '#FFFFFF';
      cellStyle.fontWeight = 700;
    } else if (inRange) {
      cellStyle.backgroundColor = 'var(--accent-glow)';
      cellStyle.color = 'var(--text-primary)';
    } else {
      cellStyle.backgroundColor = 'transparent';
      cellStyle.color = 'var(--text-primary)';
    }

    if (today && !selected) {
      cellStyle.border = '1px dashed var(--border-active)';
    }

    dayCells.push(
      <div 
        key={date.format('YYYY-MM-DD')} 
        style={cellStyle}
        onClick={() => handleDayClick(date)}
        onMouseEnter={() => setHoverDate(date)}
      >
        {i}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
      {/* Top Filter Presets */}
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => handlePreset(0)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            padding: '6px 12px',
            borderRadius: '2px',
            border: '1px solid var(--border-default)',
            backgroundColor: activePreset === 0 ? 'var(--accent-primary)' : 'var(--bg-surface-alt)',
            color: activePreset === 0 ? '#FFFFFF' : 'var(--text-primary)',
            fontWeight: activePreset === 0 ? 700 : 500,
            cursor: 'pointer'
          }}
        >
          TODAY
        </button>
        <button
          type="button"
          onClick={() => handlePreset(6)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            padding: '6px 12px',
            borderRadius: '2px',
            border: '1px solid var(--border-default)',
            backgroundColor: activePreset === 6 ? 'var(--accent-primary)' : 'var(--bg-surface-alt)',
            color: activePreset === 6 ? '#FFFFFF' : 'var(--text-primary)',
            fontWeight: activePreset === 6 ? 700 : 500,
            cursor: 'pointer'
          }}
        >
          LAST 7 DAYS
        </button>
        <button
          type="button"
          onClick={() => handlePreset(29)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            padding: '6px 12px',
            borderRadius: '2px',
            border: '1px solid var(--border-default)',
            backgroundColor: activePreset === 29 ? 'var(--accent-primary)' : 'var(--bg-surface-alt)',
            color: activePreset === 29 ? '#FFFFFF' : 'var(--text-primary)',
            fontWeight: activePreset === 29 ? 700 : 500,
            cursor: 'pointer'
          }}
        >
          LAST 30 DAYS
        </button>
      </div>

      {/* Month Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', padding: '0 8px' }}>
        <button 
          type="button" 
          onClick={() => { soundFx.playClick(); setViewMonth(viewMonth.subtract(1, 'month')); }}
          style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '6px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={18} />
        </button>
        <span>{viewMonth.format('MMMM YYYY')}</span>
        <button 
          type="button" 
          onClick={() => { soundFx.playClick(); setViewMonth(viewMonth.add(1, 'month')); }}
          style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '6px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Month Day Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
          <div key={d} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', paddingBottom: '4px' }}>
            {d}
          </div>
        ))}
        {dayCells}
      </div>

      {/* Range Selection Display */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-primary)', textAlign: 'center', fontWeight: 700 }}>
        {selStart && selEnd 
          ? `[SELECTED: ${selStart.format('YYYY-MM-DD')} ➔ ${selEnd.format('YYYY-MM-DD')}]` 
          : '[SELECT START & END DATES]'}
      </div>

      {/* Modal Actions */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid var(--border-default)' }}>
        <Button variant="ghost" onClick={onClose} style={{ flex: 1, minHeight: '42px' }}>
          CANCEL
        </Button>
        <Button 
          variant="mechanical" 
          onClick={handleConfirmApply} 
          disabled={!selStart || !selEnd} 
          style={{ flex: 1, minHeight: '42px' }}
        >
          APPLY FILTER
        </Button>
      </div>
    </div>
  );
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const { openModal, closeModal } = useModal();
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [activePresetDays, setActivePresetDays] = useState<number | null>(null);
  const [viewMonthLeft, setViewMonthLeft] = useState<Dayjs>(dayjs(endDate).subtract(1, 'month').startOf('month'));
  const [viewMonthRight, setViewMonthRight] = useState<Dayjs>(dayjs(endDate).startOf('month'));
  const [selectionStart, setSelectionStart] = useState<Dayjs | null>(dayjs(startDate));
  const [selectionEnd, setSelectionEnd] = useState<Dayjs | null>(dayjs(endDate));
  const [hoverDate, setHoverDate] = useState<Dayjs | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsCustomOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenMobileModal = () => {
    soundFx.playClick();
    openModal({
      title: '[DATE_RANGE_SELECTOR]',
      position: 'center',
      size: 'sm',
      content: (
        <MobileCalendarModalContent
          initialStart={startDate}
          initialEnd={endDate}
          onApply={(start, end) => onChange(start, end)}
          onClose={closeModal}
        />
      )
    });
  };

  const handlePreset = (days: number) => {
    soundFx.playClick();
    setActivePresetDays(days);
    const end = dayjs();
    const start = dayjs().subtract(days, 'day');
    setIsCustomOpen(false);
    onChange(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
    setSelectionStart(start);
    setSelectionEnd(end);
  };

  const handleToggleCustom = () => {
    soundFx.playClick();
    setActivePresetDays(null);
    setIsCustomOpen(!isCustomOpen);
  };

  const handleDayClick = (date: Dayjs) => {
    soundFx.playClick();
    if (!selectionStart || (selectionStart && selectionEnd)) {
      setSelectionStart(date);
      setSelectionEnd(null);
    } else {
      if (date.isBefore(selectionStart)) {
        setSelectionEnd(selectionStart);
        setSelectionStart(date);
      } else {
        setSelectionEnd(date);
      }
    }
  };

  const handleApply = () => {
    if (selectionStart && selectionEnd) {
      soundFx.playClick();
      onChange(selectionStart.format('YYYY-MM-DD'), selectionEnd.format('YYYY-MM-DD'));
      setIsCustomOpen(false);
    }
  };

  const isToday = (date: Dayjs) => date.isSame(dayjs(), 'day');
  const isSelected = (date: Dayjs) => (selectionStart && date.isSame(selectionStart, 'day')) || (selectionEnd && date.isSame(selectionEnd, 'day'));
  const isInRange = (date: Dayjs) => {
    if (selectionStart && selectionEnd) return date.isBetween(selectionStart, selectionEnd, 'day', '[]');
    if (selectionStart && hoverDate) {
      const start = selectionStart.isBefore(hoverDate) ? selectionStart : hoverDate;
      const end = selectionStart.isBefore(hoverDate) ? hoverDate : selectionStart;
      return date.isBetween(start, end, 'day', '[]');
    }
    return false;
  };

  const renderCalendar = (month: Dayjs, setMonth: (m: Dayjs) => void) => {
    const startOfMonth = month.startOf('month');
    const startDay = startOfMonth.day();
    const daysInMonth = month.daysInMonth();
    
    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="date-picker-day empty" />);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const date = month.date(i);
      const selected = isSelected(date);
      const inRange = isInRange(date);
      const today = isToday(date);
      
      let dayStyle: React.CSSProperties = {
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        height: '32px',
        width: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        borderRadius: selected ? '2px' : '0px',
        transition: 'all 0.15s ease',
      };

      if (selected) {
        dayStyle.backgroundColor = 'var(--accent-primary)';
        dayStyle.color = '#FFFFFF';
        dayStyle.fontWeight = 700;
      } else if (inRange) {
        dayStyle.backgroundColor = 'var(--accent-glow)';
        dayStyle.color = 'var(--text-primary)';
      } else {
        dayStyle.backgroundColor = 'transparent';
        dayStyle.color = 'var(--text-primary)';
      }

      if (today && !selected) {
        dayStyle.border = '1px dashed var(--border-active)';
      }

      days.push(
        <div 
          key={date.format('YYYY-MM-DD')} 
          className="calendar-day-cell"
          style={dayStyle}
          onClick={() => handleDayClick(date)}
          onMouseEnter={() => setHoverDate(date)}
        >
          {i}
        </div>
      );
    }

    return (
      <div className="date-picker-calendar" style={{ width: '220px' }}>
        <div className="date-picker-calendar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>
          <button 
            type="button"
            className="date-picker-nav" 
            onClick={() => { soundFx.playClick(); setMonth(month.subtract(1, 'month')); }}
            style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', color: 'var(--text-primary)', padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span>{month.format('MMM YYYY')}</span>
          <button 
            type="button"
            className="date-picker-nav" 
            onClick={() => { soundFx.playClick(); setMonth(month.add(1, 'month')); }}
            style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', color: 'var(--text-primary)', padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="date-picker-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
            <div key={d} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', paddingBottom: '6px' }}>
              {d}
            </div>
          ))}
          {days}
        </div>
      </div>
    );
  };

  const getPresetBtnStyle = (days: number): React.CSSProperties => {
    const isActive = activePresetDays === days && !isCustomOpen;
    return {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      fontWeight: isActive ? 700 : 500,
      textTransform: 'uppercase',
      padding: '6px 12px',
      border: '1px solid var(--border-default)',
      borderRadius: '2px',
      cursor: 'pointer',
      backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-surface)',
      color: isActive ? '#FFFFFF' : 'var(--text-primary)',
      transition: 'all 0.15s ease',
    };
  };

  return (
    <div className="date-picker-container" ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Desktop View: Row of presets */}
      <div className="preset-tab-bar date-picker-presets desktop-date-presets" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button type="button" style={getPresetBtnStyle(0)} onClick={() => handlePreset(0)}>Today</button>
        <button type="button" style={getPresetBtnStyle(6)} onClick={() => handlePreset(6)}>Last 7 Days</button>
        <button type="button" style={getPresetBtnStyle(29)} onClick={() => handlePreset(29)}>Last 30 Days</button>
        <button 
          type="button"
          style={{
            ...getPresetBtnStyle(-1),
            backgroundColor: isCustomOpen ? 'var(--accent-primary)' : 'var(--bg-surface)',
            color: isCustomOpen ? '#FFFFFF' : 'var(--text-primary)',
            fontWeight: isCustomOpen ? 700 : 500,
          }}
          onClick={handleToggleCustom}
        >
          <CalendarIcon size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />
          Custom
        </button>
      </div>

      {/* Mobile View: Single Calendar Trigger Button */}
      <div className="mobile-date-trigger-wrap">
        <Button 
          variant="mechanical" 
          onClick={handleOpenMobileModal}
          leftIcon={<CalendarIcon size={16} />}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, padding: '0.6rem 1.2rem' }}
        >
          Calendar
        </Button>
      </div>

      {/* Desktop Custom Dropdown */}
      {isCustomOpen && (
        <div 
          className="punchcard-calendar date-picker-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'var(--bg-surface)',
            border: '2px solid var(--border-default)',
            boxShadow: 'var(--shadow-paper)',
            borderRadius: '2px',
            padding: '16px',
            zIndex: 100,
            animation: 'slideDown 0.15s ease-out',
          }}
        >
          <div className="date-picker-calendars" style={{ display: 'flex', gap: '16px' }}>
            {renderCalendar(viewMonthLeft, (m) => { setViewMonthLeft(m); if (m.isSame(viewMonthRight, 'month') || m.isAfter(viewMonthRight, 'month')) setViewMonthRight(m.add(1, 'month')); })}
            {renderCalendar(viewMonthRight, (m) => { setViewMonthRight(m); if (m.isSame(viewMonthLeft, 'month') || m.isBefore(viewMonthLeft, 'month')) setViewMonthLeft(m.subtract(1, 'month')); })}
          </div>
          <div className="date-picker-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-default)' }}>
            <button 
              type="button" 
              className="btn-ghost" 
              onClick={() => { soundFx.playClick(); setIsCustomOpen(false); }}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: '6px 12px',
                border: '1px solid var(--border-default)',
                borderRadius: '2px',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn-primary" 
              disabled={!selectionStart || !selectionEnd} 
              onClick={handleApply}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: '6px 12px',
                border: 'none',
                borderRadius: '2px',
                background: 'var(--accent-primary)',
                color: '#FFFFFF',
                cursor: selectionStart && selectionEnd ? 'pointer' : 'not-allowed',
                opacity: selectionStart && selectionEnd ? 1 : 0.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                boxShadow: 'var(--shadow-3d-btn)',
              }}
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
