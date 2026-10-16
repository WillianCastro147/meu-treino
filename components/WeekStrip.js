'use client';

import { dayKey, weekStart } from '@/lib/stats';

// Semana atual (segunda a domingo): ponto azul nos dias com treino, hoje destacado num círculo
export default function WeekStrip({ byDay, locale }) {
  const start = weekStart(new Date());
  const todayKey = dayKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  return (
    <div className="week-strip">
      {days.map((d) => {
        const k = dayKey(d);
        const trained = (byDay.get(k) || 0) > 0;
        return (
          <div key={k} className={`week-day ${k === todayKey ? 'today' : ''}`}>
            <span className="wd-name">{d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').slice(0, 3)}</span>
            <span className="wd-num">{d.getDate()}</span>
            <span className={`wd-dot ${trained ? 'on' : ''}`} />
          </div>
        );
      })}
    </div>
  );
}
