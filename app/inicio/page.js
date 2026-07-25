'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { IconTimer, IconSets, IconVolume, IconDumbbell, IconTrash } from '@/components/Icons';

export default function InicioPage() {
  return (
    <AuthGuard>
      {(user) => <Accueil user={user} />}
    </AuthGuard>
  );
}

function Accueil({ user }) {
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

  async function supprimer(id) {
    if (!confirm('Supprimer cet entraînement de votre historique ?')) return;
    await supabase.from('workouts').delete().eq('id', id);
    setWorkouts(workouts.filter((w) => w.id !== id));
  }

  return (
    <div className="page">
      <h1 className="page-title">Accueil</h1>

      {workouts === null && <p className="muted">Chargement...</p>}

      {workouts && workouts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <IconDumbbell size={48} color="var(--accent)" />
          </div>
          <p style={{ fontWeight: 700, margin: '8px 0 4px', fontSize: 17 }}>
            Aucun entraînement pour le moment
          </p>
          <p className="muted">
            Allez dans l&apos;onglet Entraînement pour créer votre première routine !
          </p>
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
                  <b style={{ fontSize: 18 }}>{w.name}</b>
                  <span className="muted">{formatDate(w.started_at)}</span>
                </div>

                <p className="muted stat-line">
                  <IconTimer /> {w.duration_min} min
                  <IconSets /> {totalSets} séries
                  <IconVolume /> {Math.round(volume)} kg
                </p>

                {/* Miniatures des exercices de la routine */}
                <div className="thumb-strip">
                  {exs.slice(0, 5).map(
                    (ex, i) =>
                      ex.gif && (
                        <img key={i} src={ex.gif} alt={ex.name} className="strip-thumb" loading="lazy" />
                      )
                  )}
                  {exs.length > 5 && <span className="strip-more">+{exs.length - 5}</span>}
                </div>
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
                            .join('  ·  ') || 'Aucune série terminée'}
                        </p>
                      </div>
                    </div>
                  ))}
                  <button className="btn danger small" style={{ marginTop: 10 }} onClick={() => supprimer(w.id)}>
                    <IconTrash /> Supprimer
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
  return (
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
}
