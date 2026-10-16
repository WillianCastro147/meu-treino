'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { useDialog } from '@/components/Dialog';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { findExercise } from '@/lib/catalog';
import { fetchPlan, savePlan } from '@/lib/data';
import { normalizePlan } from '@/lib/plan';
import { EQUIPMENT_PRESETS, GOALS, LEVELS, MINUTES } from '@/lib/coach';
import { IconBack, IconChart } from '@/components/Icons';

export default function CoachPage() {
  return <AuthGuard>{(user) => <Coach user={user} />}</AuthGuard>;
}

const PRESETS = ['gym', 'home', 'bodyweight'];

function Coach({ user }) {
  const router = useRouter();
  const dialog = useDialog();
  const { t, tf, lang, locale, exName, equipName } = useI18n();

  const [goal, setGoal] = useState('hypertrophy');
  const [level, setLevel] = useState('beginner');
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState(60);
  const [preset, setPreset] = useState('gym');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { plan, remaining }
  const [error, setError] = useState('');

  const dayName = (n) => new Date(2026, 9, 11 + n).toLocaleDateString(locale, { weekday: 'long' }); // 12/10/2026 = segunda

  async function gerar() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
        body: JSON.stringify({ goal, level, days, minutes, equipment: EQUIPMENT_PRESETS[preset], notes, lang }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const key = { not_configured: 'coachNotConfigured', limit: 'coachLimit', unauthorized: 'coachLogin' }[body.error] || 'coachError';
        setError(tf(key, { n: body.limit || '' }));
      } else setResult(body);
    } catch (e) {
      setError(t('coachError'));
    }
    setLoading(false);
  }

  // Cria as rotinas e monta a semana com os dias sugeridos
  async function salvar() {
    const plan = result.plan;
    if (!(await dialog.confirm(t('coachConfirmSave'), { confirmLabel: t('coachSave') }))) return;
    setSaving(true);
    const { data, error: err } = await supabase
      .from('routines')
      .insert(plan.routines.map((r) => ({ user_id: user.id, name: r.name, exercises: r.exercises })))
      .select('id');
    if (err) {
      setSaving(false);
      return dialog.alert(t('saveError') + err.message);
    }
    const current = await fetchPlan(user.id).catch(() => ({ plan: null, missing: true }));
    if (!current.missing) {
      const week = Object.fromEntries(plan.routines.map((r, i) => [r.day, data[i].id]));
      await savePlan(user.id, { ...normalizePlan(current.plan), mode: 'week', week });
    }
    setSaving(false);
    router.push('/treino');
  }

  const chip = (active, onClick, label) => (
    <button key={label} className={`chip ${active ? 'active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div className="page">
      <div className="page-head" style={{ justifyContent: 'flex-start', gap: 12 }}>
        <button className="round-btn" onClick={() => router.back()} aria-label={t('back')}>
          <IconBack />
        </button>
      </div>
      <PageHeader title={t('coachTitle')} sub={t('coachSub')} />

      {!result && (
        <div className="card">
          <label className="label" style={{ marginTop: 0 }}>{t('coachGoal')}</label>
          <div className="plate-chips">{GOALS.map((g) => chip(goal === g, () => setGoal(g), t('goal_' + g)))}</div>

          <label className="label">{t('coachLevel')}</label>
          <div className="seg">
            {LEVELS.map((l) => (
              <button key={l} className={level === l ? 'active' : ''} onClick={() => setLevel(l)}>
                {t('level_' + l)}
              </button>
            ))}
          </div>

          <label className="label">{t('coachDays')}</label>
          <div className="seg">
            {[2, 3, 4, 5, 6].map((d) => (
              <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
                {d}
              </button>
            ))}
          </div>

          <label className="label">{t('coachMinutes')}</label>
          <div className="seg">
            {MINUTES.map((m) => (
              <button key={m} className={minutes === m ? 'active' : ''} onClick={() => setMinutes(m)}>
                {m} min
              </button>
            ))}
          </div>

          <label className="label">{t('coachEquipment')}</label>
          <div className="plate-chips">{PRESETS.map((p) => chip(preset === p, () => setPreset(p), t('eq_' + p)))}</div>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            {EQUIPMENT_PRESETS[preset].slice(0, 6).map(equipName).join(' · ')}
            {EQUIPMENT_PRESETS[preset].length > 6 ? '…' : ''}
          </p>

          <label className="label">{t('coachNotes')}</label>
          <textarea
            className="input"
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('coachNotesPh')}
          />

          <button className="btn" style={{ marginTop: 16 }} onClick={gerar} disabled={loading}>
            {loading ? t('coachThinking') : t('coachGenerate')}
          </button>
          <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>{t('coachPrivacy')}</p>
          {error && <p className="error-msg">{error}</p>}
        </div>
      )}

      {result && (
        <>
          <div className="card">
            <p className="suggest-line" style={{ margin: 0 }}>
              <IconChart size={16} /> <span>{result.plan.summary}</span>
            </p>
          </div>

          {result.plan.routines.map((r, i) => (
            <div key={i} className="card">
              <p className="today-kicker" style={{ textTransform: 'capitalize' }}>{dayName(r.day)}</p>
              <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{r.name}</p>
              {r.notes && <p className="muted" style={{ marginBottom: 8 }}>{r.notes}</p>}
              {r.exercises.map((x) => (
                <div key={x.id} className="row-link" style={{ cursor: 'default' }}>
                  <img src={findExercise(x)?.gif || x.gif} alt="" className="ex-thumb" loading="lazy" />
                  <span style={{ minWidth: 0 }}>
                    <span className="ex-name ellipsis">{exName(x)}</span>
                    <span className="muted">
                      {x.sets} × {x.reps} · {x.rest}s
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ))}

          <button className="btn" onClick={salvar} disabled={saving}>
            {saving ? t('saving') : t('coachSave')}
          </button>
          <button className="btn secondary" style={{ marginTop: 10, marginBottom: 12 }} onClick={() => setResult(null)}>
            {t('coachAgain')}
          </button>
          {result.remaining != null && (
            <p className="muted" style={{ textAlign: 'center' }}>{tf('coachRemaining', { n: result.remaining })}</p>
          )}
        </>
      )}

      <BottomNav />
    </div>
  );
}
