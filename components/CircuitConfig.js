'use client';

import { useI18n } from '@/lib/i18n';
import { cleanCircuit, defaultCircuit, fmtClock } from '@/lib/circuit';

// Editor do "Tipo da rotina": Normal, Circuito, AMRAP, EMOM ou Intervalos (com atalho Tabata).
// value: null (normal) ou { mode, ... } · onChange(novoValor) · total: duração planejada em s
const TYPES = ['normal', 'circuit', 'amrap', 'emom', 'intervals'];

function Num({ label, value, onChange, min = 0, step = 1, suffix }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label className="label" style={{ margin: '0 0 4px' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input className="input" type="number" min={min} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="muted input-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

export default function CircuitConfig({ value, onChange, total }) {
  const { t, tf } = useI18n();
  const mode = value?.mode || 'normal';
  const set = (patch) => onChange(cleanCircuit({ ...value, ...patch }) || value);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <label className="label" style={{ marginTop: 0 }}>{t('routineType')}</label>
      <div className="seg seg-wrap">
        {TYPES.map((m) => (
          <button key={m} className={mode === m ? 'active' : ''} onClick={() => onChange(m === 'normal' ? null : defaultCircuit(m))}>
            {t('ctype_' + m)}
          </button>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{t('ctypeHint_' + mode)}</p>

      {mode === 'circuit' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <Num label={t('cRounds')} value={value.rounds} min={1} onChange={(v) => set({ rounds: v })} />
          <Num label={t('cGap')} value={value.gap} step={5} suffix="s" onChange={(v) => set({ gap: v })} />
          <Num label={t('cRoundRest')} value={value.roundRest} step={5} suffix="s" onChange={(v) => set({ roundRest: v })} />
        </div>
      )}

      {mode === 'amrap' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <Num label={t('cCapMin')} value={Math.round(value.cap / 60)} min={1} suffix="min" onChange={(v) => set({ cap: v * 60 })} />
        </div>
      )}

      {mode === 'emom' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <Num label={t('cEvery')} value={value.every} step={5} suffix="s" onChange={(v) => set({ every: v })} />
          <Num label={t('cCount')} value={value.count} min={1} onChange={(v) => set({ count: v })} />
        </div>
      )}

      {mode === 'intervals' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <Num label={t('cWork')} value={value.work} step={5} suffix="s" onChange={(v) => set({ work: v })} />
            <Num label={t('cRest')} value={value.rest} step={5} suffix="s" onChange={(v) => set({ rest: v })} />
            <Num label={t('cRounds')} value={value.rounds} min={1} onChange={(v) => set({ rounds: v })} />
          </div>
          <button className="link-toggle" style={{ marginTop: 10 }} onClick={() => onChange(defaultCircuit('tabata'))}>
            {t('cTabata')}
          </button>
        </>
      )}

      {mode !== 'normal' && total != null && (
        <p style={{ marginTop: 10, color: 'var(--accent)', fontWeight: 700 }}>{tf('cTotal', { time: fmtClock(total) })}</p>
      )}
    </div>
  );
}
