'use client';

import { dayKey } from '@/lib/stats';

// Gráficos em SVG puro (sem bibliotecas), no tema do app

const W = 320;
const H = 150;
const PAD = { l: 36, r: 10, t: 12, b: 20 };

function niceRange(min, max) {
  if (min === max) {
    const d = Math.max(1, Math.abs(min) * 0.05);
    return [min - d, max + d];
  }
  const d = (max - min) * 0.12;
  return [min - d, max + d];
}

const fmtShort = (v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10));

// Linha no tempo. points: [{ x: data ISO ou ms, y: número }]; goal: linha tracejada opcional
export function LineChart({ points, goal = null, locale, unit = '' }) {
  const pts = points
    .map((p) => ({ x: new Date(p.x).getTime(), y: Number(p.y) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
  if (!pts.length) return null;

  const ys = pts.map((p) => p.y).concat(goal != null ? [Number(goal)] : []);
  const [y0, y1] = niceRange(Math.min(...ys), Math.max(...ys));
  const x0 = pts[0].x;
  const x1 = pts[pts.length - 1].x === x0 ? x0 + 1 : pts[pts.length - 1].x;
  const sx = (x) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (y) => PAD.t + (1 - (y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  const single = pts.length === 1;
  const xOf = (p) => (single ? (PAD.l + W - PAD.r) / 2 : sx(p.x));

  const ticks = [y0 + (y1 - y0) * 0.1, (y0 + y1) / 2, y1 - (y1 - y0) * 0.1];
  const fmtDate = (ms) => new Date(ms).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${xOf(p).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const area = `${path} L${xOf(pts[pts.length - 1]).toFixed(1)},${H - PAD.b} L${xOf(pts[0]).toFixed(1)},${H - PAD.b} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <defs>
        <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeWidth="1" />
          <text x={PAD.l - 6} y={sy(v) + 3} textAnchor="end">
            {fmtShort(v)}
          </text>
        </g>
      ))}
      {goal != null && (
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={sy(goal)}
          y2={sy(goal)}
          stroke="var(--green)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
      )}
      {!single && <path d={area} fill="url(#lc-fill)" />}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={xOf(p)} cy={sy(p.y)} r={pts.length > 30 ? 0 : 3} fill="var(--accent)" />
      ))}
      <circle cx={xOf(last)} cy={sy(last.y)} r="4.5" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
      <text x={PAD.l} y={H - 4} textAnchor="start">
        {fmtDate(pts[0].x)}
      </text>
      {!single && (
        <text x={W - PAD.r} y={H - 4} textAnchor="end">
          {fmtDate(last.x)}
        </text>
      )}
      <text x={Math.min(xOf(last), W - PAD.r)} y={Math.max(10, sy(last.y) - 9)} textAnchor="end" style={{ fill: 'var(--text)', fontWeight: 700 }}>
        {fmtShort(last.y)}
        {unit}
      </text>
    </svg>
  );
}

// Barras verticais. bars: [{ label, value }]
export function BarChart({ bars, format = fmtShort }) {
  if (!bars.length) return null;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const n = bars.length;
  const slot = (W - PAD.l - PAD.r) / n;
  const bw = Math.max(4, slot * 0.62);
  const sy = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  // Rótulos a cada `step` barras, contando a partir da última (que sempre aparece) para não encavalar
  const step = Math.ceil(n / 6);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {[max / 2, max].map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeWidth="1" />
          <text x={PAD.l - 6} y={sy(v) + 3} textAnchor="end">
            {format(v)}
          </text>
        </g>
      ))}
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--border)" strokeWidth="1" />
      {bars.map((b, i) => {
        const x = PAD.l + i * slot + (slot - bw) / 2;
        const y = sy(b.value);
        const isLast = i === n - 1;
        return (
          <g key={i}>
            {b.value > 0 && (
              <rect
                x={x}
                y={y}
                width={bw}
                height={H - PAD.b - y}
                rx="3"
                fill="var(--accent)"
                opacity={isLast ? 1 : 0.65}
              />
            )}
            {(n - 1 - i) % step === 0 && (
              <text x={x + bw / 2} y={H - 5} textAnchor="middle">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Mapa de atividade estilo GitHub: uma coluna por semana (segunda no topo)
export function Heatmap({ byDay, weeks = 26, t }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);

  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const n = byDay.get(dayKey(d)) || 0;
    const future = d > today;
    cells.push(
      <span
        key={i}
        className={future ? 'future' : n >= 3 ? 'l3' : n === 2 ? 'l2' : n === 1 ? 'l1' : ''}
        title={`${d.toLocaleDateString()} · ${n}`}
      />
    );
  }

  return (
    <div>
      <div className="heatmap" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
        {cells}
      </div>
      <div className="heat-legend">
        {t('less')}
        <span style={{ background: 'var(--card2)' }} />
        <span style={{ background: 'rgba(59,130,246,0.45)' }} />
        <span style={{ background: 'rgba(59,130,246,0.75)' }} />
        <span style={{ background: 'var(--accent)' }} />
        {t('more')}
      </div>
    </div>
  );
}
