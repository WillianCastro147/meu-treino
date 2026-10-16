'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { fetchBodyWeights, logBodyWeight } from '@/lib/data';
import { fmtKg } from '@/lib/stats';
import { LineChart } from '@/components/Charts';

// Peso corporal: registrar o peso do dia, gráfico com a linha da meta
export default function BodyWeightCard({ user }) {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [goal, setGoal] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchBodyWeights()
      .then((r) => {
        setRows(r.rows);
        setMissing(r.missing);
      })
      .catch((e) => {
        setRows([]);
        setMsg(t('errPrefix') + e.message);
      });
    supabase
      .from('profiles')
      .select('goal_weight_kg')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.goal_weight_kg != null) {
          setGoal(data.goal_weight_kg);
          setGoalInput(String(data.goal_weight_kg));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function registrar() {
    const v = Number(String(input).replace(',', '.'));
    if (!v || v <= 0) return;
    setBusy(true);
    setMsg('');
    const { error } = await logBodyWeight(user.id, v);
    setBusy(false);
    if (error) return setMsg(t('errPrefix') + error.message);
    const r = await fetchBodyWeights();
    setRows(r.rows);
    setInput('');
  }

  async function salvarMeta() {
    const v = goalInput === '' ? null : Number(String(goalInput).replace(',', '.'));
    const { error } = await supabase.from('profiles').update({ goal_weight_kg: v }).eq('id', user.id);
    if (error) return setMsg(t('errPrefix') + error.message);
    setGoal(v ?? '');
  }

  if (rows === null) return null;

  if (missing) {
    return (
      <div className="card">
        <p className="card-title">{t('bodyWeight')}</p>
        <p className="muted">{t('weightSetup')}</p>
      </div>
    );
  }

  const last = rows[rows.length - 1];
  const goalNum = goal === '' || goal == null ? null : Number(goal);
  const diff = last && goalNum != null ? Number(last.weight_kg) - goalNum : null;

  return (
    <div className="card">
      <p className="muted" style={{ fontSize: 17 }}>{t('bodyWeight')}</p>
      {last && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '4px 0 2px' }}>
          <span className="tile-value" style={{ fontSize: 46 }}>
            {fmtKg(last.weight_kg, locale)}
            <small>kg</small>
          </span>
          <span className="muted">
            {new Date(last.measured_on + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
          </span>
        </div>
      )}

      {diff != null && (
        <p style={{ color: 'var(--accent)', marginBottom: 10, fontSize: 16 }}>
          {Math.abs(diff) < 0.05
            ? t('goalReached')
            : `${t('goal')} ${fmtKg(goalNum, locale)} kg · ${fmtKg(Math.abs(diff), locale)} kg ${t('toGoal')}`}
        </p>
      )}

      {rows.length > 0 ? (
        <LineChart points={rows.map((r) => ({ x: r.measured_on + 'T12:00:00', y: r.weight_kg }))} goal={goalNum} locale={locale} />
      ) : (
        <p className="muted">{t('noWeights')}</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          placeholder={t('todayWeight')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn small" onClick={registrar} disabled={busy || !input}>
          {t('logWeight')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          placeholder={t('goalWeight')}
          value={goalInput}
          onChange={(e) => setGoalInput(e.target.value)}
        />
        <button className="btn secondary small" onClick={salvarMeta} disabled={String(goal ?? '') === goalInput}>
          {t('saveGoal')}
        </button>
      </div>
      {msg && <p className="error-msg">{msg}</p>}
    </div>
  );
}
