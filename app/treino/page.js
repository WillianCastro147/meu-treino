'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
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
  const { t, exName } = useI18n();

  useEffect(() => {
    supabase
      .from('routines')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRoutines(data || []));
  }, []);

  async function supprimer(id) {
    if (!confirm(t('confirmDeleteRoutine'))) return;
    await supabase.from('routines').delete().eq('id', id);
    setRoutines(routines.filter((r) => r.id !== id));
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('tabWorkout')}</h1>

      <button className="btn" onClick={() => router.push('/treino/nova')}>
        <IconPlus /> {t('createRoutine')}
      </button>

      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '22px 0 10px' }}>{t('myRoutines')}</h2>

      {routines === null && <p className="muted">{t('loading')}</p>}

      {routines && routines.length === 0 && (
        <p className="muted">{t('noRoutines')}</p>
      )}

      {routines &&
        routines.map((r) => (
          <div key={r.id} className="card">
            <b style={{ fontSize: 18 }}>{r.name}</b>
            <p className="muted" style={{ margin: '4px 0 10px' }}>
              {(r.exercises || []).map((e) => exName(e)).join(' · ')}
            </p>

            <div className="thumb-strip" style={{ marginBottom: 12 }}>
              {(r.exercises || []).slice(0, 5).map(
                (e, i) =>
                  e.gif && <img key={i} src={e.gif} alt={exName(e)} className="strip-thumb" loading="lazy" />
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
                {t('start')}
              </button>
              <button
                className="btn secondary small"
                onClick={() => router.push(`/treino/nova?id=${r.id}`)}
              >
                {t('edit')}
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
