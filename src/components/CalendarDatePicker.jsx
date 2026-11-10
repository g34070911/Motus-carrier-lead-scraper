import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * Reusable visual Calendar Date Picker component.
 * Allows user to pick a date by clicking on an interactive calendar.
 * Formats dates as MM/DD/YYYY for backend compatibility.
 */
export default function CalendarDatePicker({
  value,
  onChange,
  placeholder = 'Select date from calendar',
  allowClear = false,
  onClear = null,
  label = null,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current value into a Date object (handling MM/DD/YYYY or YYYY-MM-DD)
  const parseDate = (val) => {
    if (!val || val === 'all') return new Date();
    if (val.includes('/')) {
      const parts = val.split('/');
      if (parts.length === 3) {
        const m = parseInt(parts[0], 10) - 1;
        const d = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) return date;
      }
    } else if (val.includes('-')) {
      const parts = val.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) return date;
      }
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const initialDate = parseDate(value);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Update view when value changes
  useEffect(() => {
    if (value && value !== 'all') {
      const d = parseDate(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  // Close calendar popover on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Month navigation
  const prevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Month name helper
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Days in month
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (year, month) => new Date(year, month, 1).getDay();

  // Select a day
  const handleSelectDay = (day, e) => {
    e.stopPropagation();
    const mPadded = String(viewMonth + 1).padStart(2, '0');
    const dPadded = String(day).padStart(2, '0');
    const formatted = `${mPadded}/${dPadded}/${viewYear}`;
    onChange(formatted);
    setIsOpen(false);
  };

  // Select today
  const handleSelectToday = (e) => {
    e.stopPropagation();
    const today = new Date();
    const mPadded = String(today.getMonth() + 1).padStart(2, '0');
    const dPadded = String(today.getDate()).padStart(2, '0');
    const formatted = `${mPadded}/${dPadded}/${today.getFullYear()}`;
    onChange(formatted);
    setIsOpen(false);
  };

  // Clear date
  const handleClear = (e) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else {
      onChange('');
    }
    setIsOpen(false);
  };

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfWeek(viewYear, viewMonth);

  // Selected date comparison
  const selectedDateObj = (value && value !== 'all') ? parseDate(value) : null;
  const isSelectedDay = (day) => {
    if (!selectedDateObj) return false;
    return (
      selectedDateObj.getDate() === day &&
      selectedDateObj.getMonth() === viewMonth &&
      selectedDateObj.getFullYear() === viewYear
    );
  };

  const isToday = (day) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear
    );
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: '#000000' }}>
          {label}
        </label>
      )}

      {/* Trigger Button showing currently selected date with calendar icon */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 cursor-pointer transition-all border hover:border-indigo-500 bg-white"
        style={{
          border: '1.5px solid #94a3b8',
          color: '#000000',
          boxShadow: isOpen ? '0 0 0 3px rgba(79, 70, 229, 0.15)' : 'none'
        }}
      >
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <CalendarIcon className="h-4 w-4 shrink-0 text-indigo-600" />
          <span className="text-sm font-bold truncate" style={{ color: '#000000' }}>
            {value && value !== 'all' ? value : (placeholder || 'Pick Date from Calendar')}
          </span>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          {allowClear && value && value !== 'all' && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
              title="Clear Date"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            Calendar
          </span>
        </div>
      </div>

      {/* Visual Calendar Popover Grid */}
      {isOpen && (
        <div
          className="absolute z-50 left-0 mt-2 p-4 rounded-2xl shadow-2xl border bg-white min-w-[290px] max-w-[320px]"
          style={{ borderColor: '#cbd5e1', boxShadow: '0 12px 36px rgba(0, 0, 0, 0.15)' }}
        >
          {/* Calendar Header with Month/Year Navigation */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b" style={{ borderColor: '#e2e8f0' }}>
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-700"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-center font-extrabold text-sm" style={{ color: '#000000' }}>
              {monthNames[viewMonth]} {viewYear}
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-700"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
              <div key={i} className="text-[11px] font-extrabold uppercase py-1" style={{ color: '#64748b' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots for days before start of month */}
            {Array.from({ length: startDay }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-8 w-8" />
            ))}

            {/* Day buttons */}
            {Array.from({ length: totalDays }).map((_, idx) => {
              const day = idx + 1;
              const selected = isSelectedDay(day);
              const today = isToday(day);

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={(e) => handleSelectDay(day, e)}
                  className={`h-8 w-8 mx-auto rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                    selected
                      ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                      : today
                      ? 'border border-indigo-500 text-indigo-700 font-extrabold hover:bg-indigo-50'
                      : 'hover:bg-slate-100 text-slate-900'
                  }`}
                  style={selected ? { background: '#312e81', color: '#ffffff' } : {}}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Bottom Actions: Today / Clear / Show All */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t text-xs font-bold" style={{ borderColor: '#e2e8f0' }}>
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Today
            </button>

            {allowClear && (
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-500 hover:text-red-600 hover:underline"
              >
                All Dates / Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
