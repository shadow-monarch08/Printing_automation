import React, { useState, useRef, useEffect } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

dayjs.extend(isBetween);

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
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
    const end = dayjs();
    const start = dayjs().subtract(days, 'day');
    setIsCustomOpen(false);
    onChange(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
    setSelectionStart(start);
    setSelectionEnd(end);
  };

  const handleDayClick = (date: Dayjs) => {
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
    const startDay = startOfMonth.day(); // 0 = Sunday
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
      
      let className = "date-picker-day";
      if (selected) className += " selected";
      else if (inRange) className += " in-range";
      if (today) className += " today";

      days.push(
        <div 
          key={date.format('YYYY-MM-DD')} 
          className={className}
          onClick={() => handleDayClick(date)}
          onMouseEnter={() => setHoverDate(date)}
        >
          {i}
        </div>
      );
    }

    return (
      <div className="date-picker-calendar">
        <div className="date-picker-calendar-header">
          <button className="date-picker-nav" onClick={() => setMonth(month.subtract(1, 'month'))}><ChevronLeft size={16} /></button>
          <span>{month.format('MMMM YYYY')}</span>
          <button className="date-picker-nav" onClick={() => setMonth(month.add(1, 'month'))}><ChevronRight size={16} /></button>
        </div>
        <div className="date-picker-grid">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="date-picker-weekday">{d}</div>)}
          {days}
        </div>
      </div>
    );
  };

  return (
    <div className="date-picker-container" ref={containerRef}>
      <div className="date-picker-presets">
        <button className="date-picker-preset-btn" onClick={() => handlePreset(0)}>Today</button>
        <button className="date-picker-preset-btn" onClick={() => handlePreset(6)}>Last 7 Days</button>
        <button className="date-picker-preset-btn" onClick={() => handlePreset(29)}>Last 30 Days</button>
        <button 
          className={`date-picker-preset-btn ${isCustomOpen ? 'active' : ''}`}
          onClick={() => setIsCustomOpen(!isCustomOpen)}
        >
          <CalendarIcon size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />
          Custom Range
        </button>
      </div>

      {isCustomOpen && (
        <div className="date-picker-dropdown">
          <div className="date-picker-calendars">
            {renderCalendar(viewMonthLeft, (m) => { setViewMonthLeft(m); if (m.isSame(viewMonthRight, 'month') || m.isAfter(viewMonthRight, 'month')) setViewMonthRight(m.add(1, 'month')); })}
            {renderCalendar(viewMonthRight, (m) => { setViewMonthRight(m); if (m.isSame(viewMonthLeft, 'month') || m.isBefore(viewMonthLeft, 'month')) setViewMonthLeft(m.subtract(1, 'month')); })}
          </div>
          <div className="date-picker-actions">
            <button className="btn btn-ghost" onClick={() => setIsCustomOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={!selectionStart || !selectionEnd} onClick={handleApply}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
};
