'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { IconLogo } from '@/components/Icons';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(traduireErreur(error.message));
      else router.replace('/inicio');
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) {
        setError(traduireErreur(error.message));
      } else if (data.session) {
        router.replace('/inicio');
      } else {
        setMsg('Compte créé ! Vérifiez votre e-mail pour confirmer votre inscription.');
      }
    }
    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
          <IconLogo size={36} />
          <h1 style={{ fontSize: 34, fontWeight: 800, textAlign: 'center' }}>Moviq</h1>
        </div>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 24, fontSize: 15 }}>
          {mode === 'login' ? 'Connectez-vous à votre compte' : 'Créez votre compte gratuit'}
        </p>

        <form onSubmit={handleSubmit} className="card">
          {mode === 'signup' && (
            <>
              <label className="label">Nom</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                required
              />
            </>
          )}

          <label className="label">E-mail</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@email.com"
            required
          />

          <label className="label">Mot de passe</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 caractères"
            minLength={6}
            required
          />

          <button className="btn" style={{ marginTop: 18 }} disabled={loading}>
            {loading ? 'Veuillez patienter...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>

          {error && <p className="error-msg">{error}</p>}
          {msg && <p className="success-msg">{msg}</p>}
        </form>

        <p className="muted" style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
          {mode === 'login' ? "Pas encore de compte ?" : 'Déjà un compte ?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setMsg('');
            }}
            style={{ background: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}
          >
            {mode === 'login' ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  );
}

function traduireErreur(msg) {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (msg.includes('already registered')) return 'Cet e-mail est déjà enregistré.';
  if (msg.includes('at least 6 characters')) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (msg.includes('Email not confirmed')) return 'Confirmez votre e-mail avant de vous connecter.';
  return 'Erreur : ' + msg;
}
