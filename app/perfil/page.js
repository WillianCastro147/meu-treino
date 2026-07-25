'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';

export default function PerfilPage() {
  return (
    <AuthGuard>
      {(user) => <Perfil user={user} />}
    </AuthGuard>
  );
}

function Perfil({ user }) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [stats, setStats] = useState({ total: 0, minutos: 0 });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name || '');
          setWeight(data.weight_kg || '');
          setHeight(data.height_cm || '');
        }
      });

    supabase
      .from('workouts')
      .select('duration_min')
      .then(({ data }) => {
        if (data)
          setStats({
            total: data.length,
            minutos: data.reduce((t, w) => t + (w.duration_min || 0), 0),
          });
      });
  }, [user.id]);

  async function salvar() {
    setMsg('');
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: name.trim(),
      weight_kg: weight === '' ? null : Number(weight),
      height_cm: height === '' ? null : Number(height),
      updated_at: new Date().toISOString(),
    });
    setMsg(error ? 'Erro ao salvar: ' + error.message : 'Perfil salvo! ✓');
  }

  const imc =
    weight && height ? (Number(weight) / Math.pow(Number(height) / 100, 2)).toFixed(1) : null;

  return (
    <div className="page">
      <h1 className="page-title">Perfil</h1>

      <div className="stat-grid">
        <div className="stat">
          <b>{stats.total}</b>
          <span className="muted">treinos</span>
        </div>
        <div className="stat">
          <b>{Math.round(stats.minutos / 60)}h</b>
          <span className="muted">treinadas</span>
        </div>
        <div className="stat">
          <b>{imc || '--'}</b>
          <span className="muted">IMC</span>
        </div>
      </div>

      <div className="card">
        <label className="label" style={{ marginTop: 0 }}>Nome</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="label">E-mail</label>
        <input className="input" value={user.email} disabled style={{ opacity: 0.6 }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Peso (kg)</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Altura (cm)</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
        </div>

        <button className="btn" style={{ marginTop: 16 }} onClick={salvar}>
          Salvar perfil
        </button>
        {msg && <p className={msg.includes('Erro') ? 'error-msg' : 'success-msg'}>{msg}</p>}
      </div>

      <button className="btn danger" onClick={() => supabase.auth.signOut()}>
        Sair da conta
      </button>

      <BottomNav />
    </div>
  );
}
