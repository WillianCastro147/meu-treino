'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import LangSwitcher from '@/components/LangSwitcher';

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
  const [msgErr, setMsgErr] = useState(false);
  const { t } = useI18n();

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
    setMsgErr(!!error);
    setMsg(error ? t('errPrefix') + error.message : t('profileSaved'));
  }

  const imc =
    weight && height ? (Number(weight) / Math.pow(Number(height) / 100, 2)).toFixed(1) : null;

  return (
    <div className="page">
      <h1 className="page-title">{t('tabProfile')}</h1>

      <div className="stat-grid">
        <div className="stat">
          <b>{stats.total}</b>
          <span className="muted">{t('sessions')}</span>
        </div>
        <div className="stat">
          <b>{fmtDuration(stats.minutes)}</b>
          <span className="muted">{t('trainingTime')}</span>
        </div>
        <div className="stat">
          <b>{imc || '--'}</b>
          <span className="muted">{t('bmi')}</span>
        </div>
      </div>

      <div className="card">
        <label className="label" style={{ marginTop: 0 }}>{t('name')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="label">{t('email')}</label>
        <input className="input" value={user.email} disabled style={{ opacity: 0.6 }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="label">{t('weight')}</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">{t('height')}</label>
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
          {t('saveProfile')}
        </button>
        {msg && <p className={msgErr ? 'error-msg' : 'success-msg'}>{msg}</p>}
      </div>

      <div className="card">
        <label className="label" style={{ marginTop: 0 }}>{t('language')}</label>
        <LangSwitcher style={{ marginTop: 6 }} />
      </div>

      <button className="btn danger" onClick={() => supabase.auth.signOut()}>
        {t('logout')}
      </button>

      <BottomNav />
    </div>
  );
}

// 45 → "45min" · 90 → "1h30" · 600 → "10h"
function fmtDuration(min) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h >= 10 || m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
