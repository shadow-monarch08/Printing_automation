import React, { useState, useRef, useEffect } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { soundFx } from '../../utils/sound';

dayjs.extend(isBetween);

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
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
        dayStyle.color = 'var(--btn-text, #FFFFFF)';
        dayStyle.fontWeight = 700;
        dayStyle.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.2)';
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
      color: isActive ? 'var(--btn-text, #FFFFFF)' : 'var(--text-primary)',
      transition: 'all 0.15s ease',
    };
  };

  return (
    <div className="date-picker-container" ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div className="preset-tab-bar date-picker-presets" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button type="button" style={getPresetBtnStyle(0)} onClick={() => handlePreset(0)}>Today</button>
        <button type="button" style={getPresetBtnStyle(6)} onClick={() => handlePreset(6)}>Last 7 Days</button>
        <button type="button" style={getPresetBtnStyle(29)} onClick={() => handlePreset(29)}>Last 30 Days</button>
        <button 
          type="button"
          style={{
            ...getPresetBtnStyle(-1),
            backgroundColor: isCustomOpen ? 'var(--accent-primary)' : 'var(--bg-surface)',
            color: isCustomOpen ? 'var(--btn-text, #FFFFFF)' : 'var(--text-primary)',
            fontWeight: isCustomOpen ? 700 : 500,
          }}
          onClick={handleToggleCustom}
        >
          <CalendarIcon size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />
          Custom
        </button>
      </div>

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
                color: 'var(--btn-text, #FFFFFF)',
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
