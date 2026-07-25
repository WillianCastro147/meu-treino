'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';

export default function PerfilPage() {
  return (
    <AuthGuard>
      {(user) => <Profil user={user} />}
    </AuthGuard>
  );
}

function Profil({ user }) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [stats, setStats] = useState({ total: 0, minutes: 0 });
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
            minutes: data.reduce((t, w) => t + (w.duration_min || 0), 0),
          });
      });
  }, [user.id]);

  async function sauvegarder() {
    setMsg('');
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: name.trim(),
      weight_kg: weight === '' ? null : Number(weight),
      height_cm: height === '' ? null : Number(height),
      updated_at: new Date().toISOString(),
    });
    setMsg(error ? 'Erreur : ' + error.message : 'Profil sauvegardé !');
  }

  const imc =
    weight && height ? (Number(weight) / Math.pow(Number(height) / 100, 2)).toFixed(1) : null;

  return (
    <div className="page">
      <h1 className="page-title">Profil</h1>

      <div className="stat-grid">
        <div className="stat">
          <b>{stats.total}</b>
          <span className="muted">séances</span>
        </div>
        <div className="stat">
          <b>{Math.round(stats.minutes / 60)}h</b>
          <span className="muted">d&apos;entraînement</span>
        </div>
        <div className="stat">
          <b>{imc || '--'}</b>
          <span className="muted">IMC</span>
        </div>
      </div>

      <div className="card">
        <label className="label" style={{ marginTop: 0 }}>Nom</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="label">E-mail</label>
        <input className="input" value={user.email} disabled style={{ opacity: 0.6 }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Poids (kg)</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Taille (cm)</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
        </div>

        <button className="btn" style={{ marginTop: 16 }} onClick={sauvegarder}>
          Sauvegarder le profil
        </button>
        {msg && <p className={msg.includes('Erreur') ? 'error-msg' : 'success-msg'}>{msg}</p>}
      </div>

      <button className="btn danger" onClick={() => supabase.auth.signOut()}>
        Se déconnecter
      </button>

      <BottomNav />
    </div>
  );
}
