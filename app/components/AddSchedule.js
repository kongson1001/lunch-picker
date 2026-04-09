'use client';
import { useState } from 'react';

export default function AddSchedule({ onAdd }) {
  const [date, setDate] = useState('');
  const [hasTime, setHasTime] = useState(false);
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date) return;
    const schedule = { date, hasTime };
    if (hasTime) {
      schedule.hour = Number(hour);
      schedule.minute = Number(minute);
    }
    onAdd(schedule);
    setDate('');
    setHasTime(false);
    setHour(18);
    setMinute(0);
  };

  const formatPreview = () => {
    if (!date) return '';
    const d = new Date(date + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dateStr = `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
    if (!hasTime) return dateStr;
    const h = String(hour).padStart(2, '0');
    const m = String(minute).padStart(2, '0');
    return `${dateStr} ${h}:${m}`;
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <form className="add-schedule" onSubmit={handleSubmit}>
      <div className="add-schedule-row">
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="add-schedule-row add-schedule-radio">
        <label>
          <input
            type="radio"
            name="hasTime"
            checked={!hasTime}
            onChange={() => setHasTime(false)}
          />
          날짜만
        </label>
        <label>
          <input
            type="radio"
            name="hasTime"
            checked={hasTime}
            onChange={() => setHasTime(true)}
          />
          시간 포함
        </label>
      </div>
      {hasTime && (
        <div className="add-schedule-row add-schedule-time">
          <select value={hour} onChange={(e) => setHour(e.target.value)}>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, '0')}시</option>
            ))}
          </select>
          <select value={minute} onChange={(e) => setMinute(e.target.value)}>
            {[0, 10, 20, 30, 40, 50].map(m => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
            ))}
          </select>
        </div>
      )}
      {date && <p className="schedule-preview">{formatPreview()}</p>}
      <button type="submit" className="schedule-add-btn" disabled={!date}>
        + 일정 추가
      </button>
    </form>
  );
}
