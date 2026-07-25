'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';

export default function InicioPage() {
  return (
    <AuthGuard>
      {(user) => <Inicio user={user} />}
    </AuthGuard>
  );
}

function Inicio({ user }) {
  const [workouts, setWorkouts] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    supabase
      .from('workouts')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setWorkouts(data || []));
  }, []);

  async function excluir(id) {
    if (!confirm('Excluir este treino do histórico?')) return;
    await supabase.from('workouts').delete().eq('id', id);
    setWorkouts(workouts.filter((w) => w.id !== id));
  }

  return (
    <div className="page">
      <h1 className="page-title">Início</h1>

      {workouts === null && <p className="muted">Carregando...</p>}

      {workouts && workouts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <p style={{ fontSize: 40 }}>🏋️</p>
          <p style={{ fontWeight: 700, margin: '8px 0 4px' }}>Nenhum treino ainda</p>
          <p className="muted">Vá na aba Treino para criar sua primeira rotina e começar!</p>
        </div>
      )}

      {workouts &&
        workouts.map((w) => {
          const exs = w.exercises || [];
          const volume = exs.reduce(
            (t, ex) =>
              t +
              ex.sets.reduce((s, set) => s + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0),
            0
          );
          const totalSets = exs.reduce((t, ex) => t + ex.sets.filter((s) => s.done).length, 0);
          const isOpen = expanded === w.id;

          return (
            <div key={w.id} className="card">
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : w.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <b style={{ fontSize: 16 }}>{w.name}</b>
                  <span className="muted">{formatDate(w.started_at)}</span>
                </div>
                <p className="muted" style={{ marginTop: 6 }}>
                  ⏱ {w.duration_min} min &nbsp;·&nbsp; 🔢 {totalSets} séries &nbsp;·&nbsp; 🏋️{' '}
                  {Math.round(volume)} kg de volume
                </p>
              </div>

              {isOpen && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  {exs.map((ex, i) => (
                    <div key={i} className="ex-row">
                      {ex.gif && <img src={ex.gif} alt="" className="ex-thumb" loading="lazy" />}
                      <div>
                        <p className="ex-name">{ex.name}</p>
                        <p className="muted">
                          {ex.sets
                            .filter((s) => s.done)
                            .map((s) => `${s.weight || 0}kg × ${s.reps || 0}`)
                            .join('  ·  ') || 'Nenhuma série concluída'}
                        </p>
                      </div>
                    </div>
                  ))}
                  <button className="btn danger small" style={{ marginTop: 10 }} onClick={() => excluir(w.id)}>
                    Excluir treino
                  </button>
                </div>
              )}
            </div>
          );
        })}

      <BottomNav />
    </div>
  );
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
