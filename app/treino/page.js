'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { IconPlus, IconTrash } from '@/components/Icons';

export default function TreinoPage() {
  return (
    <AuthGuard>
      {(user) => <Entrainement user={user} />}
    </AuthGuard>
  );
}

function Entrainement({ user }) {
  const router = useRouter();
  const [routines, setRoutines] = useState(null);

  useEffect(() => {
    supabase
      .from('routines')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRoutines(data || []));
  }, []);

  async function supprimer(id) {
    if (!confirm('Supprimer cette routine ?')) return;
    await supabase.from('routines').delete().eq('id', id);
    setRoutines(routines.filter((r) => r.id !== id));
  }

  return (
    <div className="page">
      <h1 className="page-title">Entraînement</h1>

      <button className="btn" onClick={() => router.push('/treino/nova')}>
        <IconPlus /> Créer une nouvelle routine
      </button>

      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '22px 0 10px' }}>Mes routines</h2>

      {routines === null && <p className="muted">Chargement...</p>}

      {routines && routines.length === 0 && (
        <p className="muted">Vous n&apos;avez pas encore de routine. Créez la première ci-dessus !</p>
      )}

      {routines &&
        routines.map((r) => (
          <div key={r.id} className="card">
            <b style={{ fontSize: 18 }}>{r.name}</b>
            <p className="muted" style={{ margin: '4px 0 10px' }}>
              {(r.exercises || []).map((e) => e.name).join(' · ')}
            </p>

            <div className="thumb-strip" style={{ marginBottom: 12 }}>
              {(r.exercises || []).slice(0, 5).map(
                (e, i) =>
                  e.gif && <img key={i} src={e.gif} alt={e.name} className="strip-thumb" loading="lazy" />
              )}
              {(r.exercises || []).length > 5 && (
                <span className="strip-more">+{r.exercises.length - 5}</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn small"
                style={{ flex: 1 }}
                onClick={() => router.push(`/treino/executar?id=${r.id}`)}
              >
                Démarrer
              </button>
              <button
                className="btn secondary small"
                onClick={() => router.push(`/treino/nova?id=${r.id}`)}
              >
                Modifier
              </button>
              <button className="btn danger small" onClick={() => supprimer(r.id)}>
                <IconTrash />
              </button>
            </div>
          </div>
        ))}

      <BottomNav />
    </div>
  );
}
