'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { IconCheck, IconPlus, IconRest } from '@/components/Icons';

export default function ExecutarPage() {
  return (
    <AuthGuard>
      {(user) => (
        <Suspense fallback={<p className="muted">Chargement...</p>}>
          <Seance user={user} />
        </Suspense>
      )}
    </AuthGuard>
  );
}

function Seance({ user }) {
  const router = useRouter();
  const params = useSearchParams();
  const routineId = params.get('id');

  const [routine, setRoutine] = useState(null);
  const [exs, setExs] = useState([]); // [{name, gif, rest, sets: [{weight, reps, done}]}]
  const [seconds, setSeconds] = useState(0);
  const [restLeft, setRestLeft] = useState(null); // segundos restantes de repos
  const [saving, setSaving] = useState(false);
  const startRef = useRef(new Date());

  // Chronomètre global
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Compte à rebours du repos
  useEffect(() => {
    if (restLeft === null) return;
    if (restLeft <= 0) {
      bip();
      setRestLeft(null);
      return;
    }
    const t = setTimeout(() => setRestLeft(restLeft - 1), 1000);
    return () => clearTimeout(t);
  }, [restLeft]);

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
            rest: e.rest ?? 60,
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

    // Démarre le repos quand une série est cochée
    if (field === 'done' && value === true && copy[ei].rest > 0) {
      setRestLeft(copy[ei].rest);
    }
  }

  function addSet(ei) {
    const copy = exs.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
    const last = copy[ei].sets[copy[ei].sets.length - 1];
    copy[ei].sets.push({ weight: last?.weight || '', reps: last?.reps || 10, done: false });
    setExs(copy);
  }

  async function terminer() {
    const anyDone = exs.some((e) => e.sets.some((s) => s.done));
    if (!anyDone && !confirm('Aucune série terminée. Terminer quand même ?')) return;

    setSaving(true);
    const { error } = await supabase.from('workouts').insert({
      user_id: user.id,
      name: routine?.name || 'Séance',
      started_at: startRef.current.toISOString(),
      duration_min: Math.max(1, Math.round(seconds / 60)),
      exercises: exs,
    });
    setSaving(false);

    if (error) alert('Erreur lors de la sauvegarde : ' + error.message);
    else router.replace('/inicio');
  }

  if (!routine) return <div className="page"><p className="muted">Chargement...</p></div>;

  return (
    <div className="page" style={{ paddingBottom: 130 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 16px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>{routine.name}</h1>
        <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 20 }}>{fmt(seconds)}</span>
      </div>

      {exs.map((ex, ei) => (
        <div key={ei} className="card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
            {ex.gif && <img src={ex.gif} alt="" className="ex-thumb big" />}
            <div>
              <b style={{ fontSize: 17 }}>{ex.name}</b>
              {ex.rest > 0 && (
                <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <IconRest size={14} /> Repos : {ex.rest}s
                </p>
              )}
            </div>
          </div>

          <div className="set-grid muted" style={{ fontSize: 13, fontWeight: 700 }}>
            <span style={{ textAlign: 'center' }}>SÉRIE</span>
            <span style={{ textAlign: 'center' }}>KG</span>
            <span style={{ textAlign: 'center' }}>REPS</span>
            <span></span>
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
                aria-label="Série terminée"
              >
                <IconCheck />
              </button>
            </div>
          ))}

          <button className="btn secondary small" onClick={() => addSet(ei)}>
            <IconPlus size={14} /> Série
          </button>
        </div>
      ))}

      <button className="btn" style={{ background: 'var(--green)' }} onClick={terminer} disabled={saving}>
        {saving ? 'Sauvegarde...' : 'Terminer la séance'}
      </button>
      <button
        className="btn danger"
        style={{ marginTop: 10 }}
        onClick={() => {
          if (confirm('Abandonner cette séance ?')) router.replace('/treino');
        }}
      >
        Abandonner
      </button>

      {/* Barre de repos */}
      {restLeft !== null && (
        <div className="rest-bar">
          <div className="rest-info">
            <IconRest size={22} color="var(--accent)" />
            <div>
              <b style={{ fontSize: 22 }}>{fmt(restLeft)}</b>
              <p className="muted" style={{ fontSize: 12 }}>Repos en cours</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary small" onClick={() => setRestLeft(restLeft + 15)}>
              +15s
            </button>
            <button className="btn small" onClick={() => setRestLeft(null)}>
              Passer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(total) {
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// Petit bip à la fin du repos
function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start();
    o.stop(ctx.currentTime + 0.6);
    if (navigator.vibrate) navigator.vibrate(400);
  } catch (e) {}
}
