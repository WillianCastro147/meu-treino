'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';

export default function ExecutarPage() {
  return (
    <AuthGuard>
      {(user) => (
        <Suspense fallback={<p className="muted">Carregando...</p>}>
          <Executar user={user} />
        </Suspense>
      )}
    </AuthGuard>
  );
}

function Executar({ user }) {
  const router = useRouter();
  const params = useSearchParams();
  const routineId = params.get('id');

  const [routine, setRoutine] = useState(null);
  const [exs, setExs] = useState([]); // [{name, gif, sets: [{weight, reps, done}]}]
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const startRef = useRef(new Date());

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!routineId) return;
    supabase
      .from('routines')
      .select('*')
      .eq('id', routineId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setRoutine(data);
        setExs(
          (data.exercises || []).map((e) => ({
            name: e.name,
            gif: e.gif,
            sets: Array.from({ length: e.sets || 3 }, () => ({
              weight: '',
              reps: e.reps || 10,
              done: false,
            })),
          }))
        );
      });
  }, [routineId]);

  function updateSet(ei, si, field, value) {
    const copy = exs.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
    copy[ei].sets[si][field] = value;
    setExs(copy);
  }

  function addSet(ei) {
    const copy = exs.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
    const last = copy[ei].sets[copy[ei].sets.length - 1];
    copy[ei].sets.push({ weight: last?.weight || '', reps: last?.reps || 10, done: false });
    setExs(copy);
  }

  async function finalizar() {
    const anyDone = exs.some((e) => e.sets.some((s) => s.done));
    if (!anyDone && !confirm('Nenhuma série foi marcada como concluída. Finalizar mesmo assim?'))
      return;

    setSaving(true);
    const { error } = await supabase.from('workouts').insert({
      user_id: user.id,
      name: routine?.name || 'Treino',
      started_at: startRef.current.toISOString(),
      duration_min: Math.max(1, Math.round(seconds / 60)),
      exercises: exs,
    });
    setSaving(false);

    if (error) alert('Erro ao salvar: ' + error.message);
    else router.replace('/inicio');
  }

  if (!routine) return <div className="page"><p className="muted">Carregando...</p></div>;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>{routine.name}</h1>
        <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 18 }}>{fmt(seconds)}</span>
      </div>

      {exs.map((ex, ei) => (
        <div key={ei} className="card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            {ex.gif && <img src={ex.gif} alt="" className="ex-thumb" style={{ width: 64, height: 64 }} />}
            <b style={{ fontSize: 15 }}>{ex.name}</b>
          </div>

          <div className="set-grid muted" style={{ fontSize: 12, fontWeight: 700 }}>
            <span style={{ textAlign: 'center' }}>SÉRIE</span>
            <span style={{ textAlign: 'center' }}>KG</span>
            <span style={{ textAlign: 'center' }}>REPS</span>
            <span style={{ textAlign: 'center' }}>✓</span>
          </div>

          {ex.sets.map((s, si) => (
            <div key={si} className="set-grid">
              <span className="set-num">{si + 1}</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={s.weight}
                onChange={(e) => updateSet(ei, si, 'weight', e.target.value)}
              />
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={s.reps}
                onChange={(e) => updateSet(ei, si, 'reps', e.target.value)}
              />
              <button
                className={`check-btn ${s.done ? 'done' : ''}`}
                onClick={() => updateSet(ei, si, 'done', !s.done)}
              >
                ✓
              </button>
            </div>
          ))}

          <button className="btn secondary small" onClick={() => addSet(ei)}>
            + Série
          </button>
        </div>
      ))}

      <button className="btn" style={{ background: 'var(--green)' }} onClick={finalizar} disabled={saving}>
        {saving ? 'Salvando...' : '✓ Finalizar treino'}
      </button>
      <button
        className="btn danger"
        style={{ marginTop: 10 }}
        onClick={() => {
          if (confirm('Descartar este treino?')) router.replace('/treino');
        }}
      >
        Descartar
      </button>
    </div>
  );
}

function fmt(total) {
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}
