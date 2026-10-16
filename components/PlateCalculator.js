'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { ALL_PLATES, BAR_OPTIONS, groupPlates, platesFor } from '@/lib/plates';
import { loadPlates, savePlates } from '@/lib/prefs';
import { fmtKg } from '@/lib/stats';

// Cores das anilhas (padrão olímpico) e altura proporcional ao tamanho
const PLATE_COLOR = { 25: '#dc2626', 20: '#2563eb', 15: '#ca8a04', 10: '#16a34a', 5: '#e5e7eb', 2.5: '#374151', 2: '#1d4ed8', 1.25: '#6b7280', 1: '#15803d', 0.5: '#9ca3af' };
const plateHeight = (p) => Math.round(36 + Math.min(1, p / 25) * 56);

// Calculadora de anilhas: carga total -> anilhas por lado, com barra e anilhas configuráveis
export default function PlateCalculator({ initialWeight, onUse, onClose }) {
  const { t, tf, locale } = useI18n();
  const [target, setTarget] = useState(initialWeight ? String(initialWeight) : '');
  const [cfg, setCfg] = useState({ bar: 20, plates: [] });

  useEffect(() => setCfg(loadPlates()), []);

  const update = (next) => {
    setCfg(next);
    savePlates(next);
  };
  const togglePlate = (p) => {
    const has = cfg.plates.includes(p);
    const plates = has ? cfg.plates.filter((x) => x !== p) : [...cfg.plates, p].sort((a, b) => b - a);
    if (plates.length) update({ ...cfg, plates });
  };

  const result = useMemo(
    () => (target === '' ? null : platesFor(Number(String(target).replace(',', '.')), cfg.bar, cfg.plates)),
    [target, cfg]
  );
  const grouped = result ? groupPlates(result.perSide) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <b style={{ fontSize: 18 }}>{t('plateCalc')}</b>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)', fontSize: 24 }} aria-label={t('close')}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <label className="label" style={{ marginTop: 0 }}>{t('targetWeight')}</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            autoFocus
          />

          {/* Desenho de um lado da barra */}
          {result && (
            <div className="plate-bar" aria-hidden="true">
              <span className="bar" />
              {result.perSide.map((p, i) => (
                <span
                  key={i}
                  className="plate"
                  style={{
                    height: plateHeight(p),
                    width: p >= 10 ? 18 : 13,
                    background: PLATE_COLOR[p] || '#64748b',
                    color: p === 5 ? '#111' : '#fff',
                  }}
                >
                  {fmtKg(p, locale)}
                </span>
              ))}
            </div>
          )}

          {target !== '' && !result && <p className="muted" style={{ margin: '12px 0' }}>{t('belowBar')}</p>}

          {result && (
            <div className="card" style={{ background: 'var(--card2)' }}>
              <p className="card-title" style={{ marginBottom: 6 }}>
                {t('perSide')}
                <span style={{ fontSize: 20, fontWeight: 800 }}>{fmtKg(result.total, locale)} kg</span>
              </p>
              <p style={{ fontSize: 17, fontWeight: 700 }}>
                {grouped.length ? grouped.map((g) => `${g.n} × ${fmtKg(g.plate, locale)}`).join('  +  ') : t('onlyBar')}
              </p>
              {result.remainder > 0 && (
                <p className="muted" style={{ marginTop: 6 }}>{tf('plateRemainder', { kg: fmtKg(result.remainder, locale) })}</p>
              )}
            </div>
          )}

          <label className="label">{t('barWeight')}</label>
          <div className="plate-chips">
            {BAR_OPTIONS.map((b) => (
              <button key={b} className={`chip ${cfg.bar === b ? 'active' : ''}`} onClick={() => update({ ...cfg, bar: b })}>
                {b} kg
              </button>
            ))}
          </div>

          <label className="label">{t('availablePlates')}</label>
          <div className="plate-chips">
            {ALL_PLATES.map((p) => (
              <button key={p} className={`chip ${cfg.plates.includes(p) ? 'active' : ''}`} onClick={() => togglePlate(p)}>
                {fmtKg(p, locale)}
              </button>
            ))}
          </div>

          {onUse && result && (
            <button className="btn" style={{ marginTop: 18 }} onClick={() => onUse(result.total)}>
              {tf('useWeight', { kg: fmtKg(result.total, locale) })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
