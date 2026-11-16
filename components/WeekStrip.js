'use client';

import { dayKey, weekStart } from '@/lib/stats';
import { IconBack, IconChevron } from '@/components/Icons';

// Semana (segunda a domingo) com setas para as semanas anteriores: ponto azul nos dias com
// treino, anel nos dias planejados (plano semanal) e hoje destacado num círculo.
// offset: 0 = esta semana, -1 = a passada... · planned: Set de dias 1..7 · onOffset(novo)
export default function WeekStrip({ byDay, locale, offset = 0, onOffset, planned = new Set(), label }) {
  const base = weekStart(new Date());
  const start = new Date(base);
  start.setDate(base.getDate() + offset * 7);
  const todayKey = dayKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  return (
    <div>
      {onOffset && (
        <div className="week-nav">
          <button className="icon-btn" onClick={() => onOffset(offset - 1)} aria-label="‹">
            <IconBack size={20} />
          </button>
          <span className="muted" style={{ fontSize: 17 }}>{label}</span>
          <button className="icon-btn" onClick={() => onOffset(Math.min(0, offset + 1))} disabled={offset >= 0} aria-label="›" style={{ opacity: offset >= 0 ? 0.3 : 1 }}>
            <IconChevron size={20} />
          </button>
        </div>
      )}
      <div className="week-strip">
        {days.map((d, i) => {
          const k = dayKey(d);
          const trained = (byDay.get(k) || 0) > 0;
          const plan = offset === 0 && planned.has(i + 1) && k >= todayKey && !trained;
          return (
            <div key={k} className={`week-day ${k === todayKey ? 'today' : ''}`}>
              <span className="wd-name">{d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').slice(0, 3)}</span>
              <span className="wd-num">{d.getDate()}</span>
              <span className={`wd-dot ${trained ? 'on' : plan ? 'plan' : ''}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
