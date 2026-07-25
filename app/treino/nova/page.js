'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import ExercisePicker from '@/components/ExercisePicker';
import { supabase } from '@/lib/supabase';

export default function NovaRotinaPage() {
  return (
    <AuthGuard>
      {(user) => (
        <Suspense fallback={<p className="muted">Carregando...</p>}>
          <NovaRotina user={user} />
        </Suspense>
      )}
    </AuthGuard>
  );
}

function NovaRotina({ user }) {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('id');

  const [name, setName] = useState('');
  const [items, setItems] = useState([]); // [{id, name, gif, category, muscle, sets: n, reps: n}]
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    supabase
      .from('routines')
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name);
          setItems(data.exercises || []);
        }
      });
  }, [editId]);

  function addExercise(ex) {
    if (items.find((i) => i.id === ex.id)) {
      setShowPicker(false);
      return;
    }
    setItems([...items, { ...ex, sets: 3, reps: 10 }]);
    setShowPicker(false);
  }

  function updateItem(idx, field, value) {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [field]: value };
    setItems(copy);
  }

  function move(idx, dir) {
    const copy = [...items];
    const j = idx + dir;
    if (j < 0 || j >= copy.length) return;
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    setItems(copy);
  }

  async function salvar() {
    if (!name.trim()) return alert('Dê um nome para a rotina.');
    if (items.length === 0) return alert('Adicione pelo menos um exercício.');
    setSaving(true);

    const payload = { user_id: user.id, name: name.trim(), exercises: items };
    const { error } = editId
      ? await supabase.from('routines').update(payload).eq('id', editId)
      : await supabase.from('routines').insert(payload);

    setSaving(false);
    if (error) alert('Erro ao salvar: ' + error.message);
    else router.push('/treino');
  }

  return (
    <div className="page">
      <h1 className="page-title">{editId ? 'Editar rotina' : 'Nova rotina'}</h1>

      <label className="label">Nome da rotina</label>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: Peito e Tríceps"
      />

      <div style={{ marginTop: 16 }}>
        {items.map((it, idx) => (
          <div key={it.id} className="card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <img src={it.gif} alt="" className="ex-thumb" loading="lazy" />
              <div style={{ flex: 1 }}>
                <p className="ex-name">{it.name}</p>
                <p className="muted">
                  {it.category}
                  {it.muscle ? ` · ${it.muscle}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button className="check-btn" onClick={() => move(idx, -1)}>↑</button>
                <button className="check-btn" onClick={() => move(idx, 1)}>↓</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label className="label" style={{ margin: '0 0 4px' }}>Séries</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={it.sets}
                  onChange={(e) => updateItem(idx, 'sets', Number(e.target.value))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label" style={{ margin: '0 0 4px' }}>Repetições</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={it.reps}
                  onChange={(e) => updateItem(idx, 'reps', Number(e.target.value))}
                />
              </div>
              <button
                className="btn danger small"
                style={{ marginTop: 18 }}
                onClick={() => setItems(items.filter((_, i) => i !== idx))}
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => setShowPicker(true)}>
        + Adicionar exercício
      </button>

      <button className="btn" style={{ marginTop: 10 }} onClick={salvar} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar rotina'}
      </button>

      {showPicker && <ExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)} />}

      <BottomNav />
    </div>
  );
}
