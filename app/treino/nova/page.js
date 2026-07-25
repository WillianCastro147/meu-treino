'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import ExercisePicker from '@/components/ExercisePicker';
import { supabase } from '@/lib/supabase';
import { IconPlus, IconRest } from '@/components/Icons';

export default function NovaRotinaPage() {
  return (
    <AuthGuard>
      {(user) => (
        <Suspense fallback={<p className="muted">Chargement...</p>}>
          <NouvelleRoutine user={user} />
        </Suspense>
      )}
    </AuthGuard>
  );
}

function NouvelleRoutine({ user }) {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('id');

  const [name, setName] = useState('');
  const [items, setItems] = useState([]); // [{id, name, gif, category, muscle, sets, reps, rest}]
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
    setItems([...items, { ...ex, sets: 3, reps: 10, rest: 60 }]);
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

  async function sauvegarder() {
    if (!name.trim()) return alert('Donnez un nom à votre routine.');
    if (items.length === 0) return alert('Ajoutez au moins un exercice.');
    setSaving(true);

    const payload = { user_id: user.id, name: name.trim(), exercises: items };
    const { error } = editId
      ? await supabase.from('routines').update(payload).eq('id', editId)
      : await supabase.from('routines').insert(payload);

    setSaving(false);
    if (error) alert('Erreur lors de la sauvegarde : ' + error.message);
    else router.push('/treino');
  }

  return (
    <div className="page">
      <h1 className="page-title">{editId ? 'Modifier la routine' : 'Nouvelle routine'}</h1>

      <label className="label">Nom de la routine</label>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex : Pectoraux et Triceps"
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

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
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
                <label className="label" style={{ margin: '0 0 4px' }}>Répétitions</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={it.reps}
                  onChange={(e) => updateItem(idx, 'reps', Number(e.target.value))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label" style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconRest size={13} /> Repos (s)
                </label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={5}
                  value={it.rest ?? 60}
                  onChange={(e) => updateItem(idx, 'rest', Number(e.target.value))}
                />
              </div>
            </div>

            <button
              className="btn danger small"
              style={{ marginTop: 10 }}
              onClick={() => setItems(items.filter((_, i) => i !== idx))}
            >
              Retirer
            </button>
          </div>
        ))}
      </div>

      <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => setShowPicker(true)}>
        <IconPlus /> Ajouter un exercice
      </button>

      <button className="btn" style={{ marginTop: 10 }} onClick={sauvegarder} disabled={saving}>
        {saving ? 'Sauvegarde...' : 'Sauvegarder la routine'}
      </button>

      {showPicker && <ExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)} />}

      <BottomNav />
    </div>
  );
}
