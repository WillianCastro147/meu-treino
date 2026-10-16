'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import ExercisePicker from '@/components/ExercisePicker';
import { useDialog } from '@/components/Dialog';
import { supabase } from '@/lib/supabase';
import { useI18n, exKey, findExercise } from '@/lib/i18n';
import { insertWorkout } from '@/lib/data';
import { setLabels, setType, SET_TYPES } from '@/lib/sets';
import { toLocalInput, fromLocalInput } from '@/lib/dates';
import { IconBack, IconPlus, IconTrash } from '@/components/Icons';

// Editar um treino já salvo (?id=) ou registrar um treino passado (sem id)
export default function RegistroPage() {
  const { t } = useI18n();
  return (
    <AuthGuard>
      {(user) => (
        <Suspense fallback={<p className="muted">{t('loading')}</p>}>
          <Registro user={user} />
        </Suspense>
      )}
    </AuthGuard>
  );
}

const TAG = { normal: null, warmup: 'W', drop: 'D', failure: 'F' };

function Registro({ user }) {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('id');
  const { t, exName } = useI18n();
  const dialog = useDialog();

  const [loaded, setLoaded] = useState(!editId);
  const [name, setName] = useState('');
  const [startedAt, setStartedAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() - 1, 0, 0, 0);
    return toLocalInput(d);
  });
  const [duration, setDuration] = useState(60);
  const [exs, setExs] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    supabase
      .from('workouts')
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name || '');
          setStartedAt(toLocalInput(new Date(data.started_at)));
          setDuration(data.duration_min || 0);
          setExs(data.exercises || []);
        }
        setLoaded(true);
      });
  }, [editId]);

  const clone = () => exs.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));

  function updateSet(ei, si, field, value) {
    const copy = clone();
    copy[ei].sets[si][field] = value;
    setExs(copy);
  }

  // Toque no rótulo: normal -> aquecimento -> drop -> falha -> normal
  function cycleType(ei, si) {
    const copy = clone();
    const s = copy[ei].sets[si];
    const next = SET_TYPES[(SET_TYPES.indexOf(setType(s)) + 1) % SET_TYPES.length];
    if (next === 'normal') delete s.type;
    else s.type = next;
    setExs(copy);
  }

  function addSet(ei) {
    const copy = clone();
    const last = copy[ei].sets[copy[ei].sets.length - 1];
    copy[ei].sets.push({ weight: last?.weight ?? '', reps: last?.reps ?? 10, done: true });
    setExs(copy);
  }

  function removeSet(ei, si) {
    const copy = clone();
    copy[ei].sets.splice(si, 1);
    if (!copy[ei].sets.length) copy.splice(ei, 1);
    setExs(copy);
  }

  function addExercise(ex) {
    setShowPicker(false);
    if (exs.find((e) => exKey(e) === exKey(ex))) return;
    setExs([
      ...clone(),
      { id: ex.id, name: ex.name?.en || exName(ex), gif: ex.gif, rest: 60, sets: [{ weight: '', reps: 10, done: true }] },
    ]);
  }

  async function sauvegarder() {
    if (!exs.length) return dialog.alert(t('alertAddExercise'));
    setSaving(true);
    // No registro manual toda série digitada conta como feita
    const exercises = exs.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) }));
    const payload = {
      name: name.trim() || t('defaultSession'),
      started_at: fromLocalInput(startedAt).toISOString(),
      duration_min: Math.max(1, Math.round(Number(duration) || 1)),
      exercises,
    };
    const { error } = editId
      ? await supabase.from('workouts').update(payload).eq('id', editId)
      : await insertWorkout({ ...payload, user_id: user.id });
    setSaving(false);
    if (error) return dialog.alert(t('saveError') + error.message);
    router.replace('/inicio');
  }

  if (!loaded) return <div className="page"><p className="muted">{t('loading')}</p></div>;

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div className="page-head" style={{ justifyContent: 'flex-start', gap: 12 }}>
        <button className="round-btn" onClick={() => router.back()} aria-label={t('back')}>
          <IconBack />
        </button>
        <h1 className="page-title" style={{ fontSize: 28 }}>{editId ? t('editWorkout') : t('logPastWorkout')}</h1>
      </div>

      <div className="card">
        <label className="label" style={{ marginTop: 0 }}>{t('routineName')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('defaultSession')} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 2 }}>
            <label className="label">{t('dateTime')}</label>
            <input className="input" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">{t('duration')} (min)</label>
            <input className="input" type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>
      </div>

      {exs.map((ex, ei) => {
        const labels = setLabels(ex.sets);
        return (
          <div key={exKey(ex) + ei} className="card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              {(findExercise(ex)?.gif || ex.gif) && <img src={findExercise(ex)?.gif || ex.gif} alt="" className="strip-thumb" />}
              <b style={{ flex: 1, fontSize: 17 }}>{exName(ex)}</b>
            </div>
            {ex.sets.map((s, si) => (
              <div key={si} className="set-grid" style={{ gridTemplateColumns: '34px 1fr 1fr 40px' }}>
                <button className={`set-label ${setType(s)}`} onClick={() => cycleType(ei, si)} aria-label={t('setTypeTitle')}>
                  {TAG[setType(s)] || labels[si]}
                </button>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  placeholder="kg"
                  value={s.weight}
                  onChange={(e) => updateSet(ei, si, 'weight', e.target.value)}
                />
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  placeholder={t('repsCol')}
                  value={s.reps}
                  onChange={(e) => updateSet(ei, si, 'reps', e.target.value)}
                />
                <button className="icon-btn" style={{ alignSelf: 'center' }} onClick={() => removeSet(ei, si)} aria-label={t('removeThisSet')}>
                  <IconTrash />
                </button>
              </div>
            ))}
            <button className="btn secondary small" style={{ width: '100%' }} onClick={() => addSet(ei)}>
              <IconPlus size={14} /> {t('addSet')}
            </button>
          </div>
        );
      })}

      <button className="btn secondary" style={{ marginBottom: 12 }} onClick={() => setShowPicker(true)}>
        <IconPlus /> {t('addExercise')}
      </button>
      <button className="btn" onClick={sauvegarder} disabled={saving}>
        {saving ? t('saving') : t('saveWorkout')}
      </button>

      {showPicker && <ExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)} />}
    </div>
  );
}
