'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';

export default function TreinoPage() {
  return (
    <AuthGuard>
      {(user) => <Treino user={user} />}
    </AuthGuard>
  );
}

function Treino({ user }) {
  const router = useRouter();
  const [routines, setRoutines] = useState(null);

  useEffect(() => {
    supabase
      .from('routines')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRoutines(data || []));
  }, []);

  async function excluir(id) {
    if (!confirm('Excluir esta rotina?')) return;
    await supabase.from('routines').delete().eq('id', id);
    setRoutines(routines.filter((r) => r.id !== id));
  }

  return (
    <div className="page">
      <h1 className="page-title">Treino</h1>

      <button className="btn" onClick={() => router.push('/treino/nova')}>
        + Criar nova rotina
      </button>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '22px 0 10px' }}>Minhas rotinas</h2>

      {routines === null && <p className="muted">Carregando...</p>}

      {routines && routines.length === 0 && (
        <p className="muted">Você ainda não tem rotinas. Crie a primeira acima! 👆</p>
      )}

      {routines &&
        routines.map((r) => (
          <div key={r.id} className="card">
            <b style={{ fontSize: 16 }}>{r.name}</b>
            <p className="muted" style={{ margin: '4px 0 12px' }}>
              {(r.exercises || []).map((e) => e.name).join(' · ')}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn small"
                style={{ flex: 1 }}
                onClick={() => router.push(`/treino/executar?id=${r.id}`)}
              >
                Iniciar treino
              </button>
              <button
                className="btn secondary small"
                onClick={() => router.push(`/treino/nova?id=${r.id}`)}
              >
                Editar
              </button>
              <button className="btn danger small" onClick={() => excluir(r.id)}>
                Excluir
              </button>
            </div>
          </div>
        ))}

      <BottomNav />
    </div>
  );
}
