'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { IconLogo } from '@/components/Icons';
import LangSwitcher from '@/components/LangSwitcher';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  function translateError(message = '') {
    if (message.includes('Invalid login credentials')) return t('errInvalid');
    if (message.includes('already registered')) return t('errRegistered');
    if (message.includes('at least 6 characters')) return t('errShort');
    if (message.includes('Email not confirmed')) return t('errNotConfirmed');
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) return t('errNetwork');
    return t('errPrefix') + message;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(translateError(error.message));
        else router.replace('/inicio');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) {
          setError(translateError(error.message));
        } else if (data.session) {
          router.replace('/inicio');
        } else {
          setMsg(t('accountCreated'));
        }
      }
    } catch (err) {
      setError(translateError(err?.message));
    }
    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <LangSwitcher style={{ margin: '0 auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
          <IconLogo size={36} />
          <h1 style={{ fontSize: 34, fontWeight: 800, textAlign: 'center' }}>Moviq</h1>
        </div>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 24, fontSize: 15 }}>
          {mode === 'login' ? t('loginSubtitle') : t('signupSubtitle')}
        </p>

        <form onSubmit={handleSubmit} className="card">
          {mode === 'signup' && (
            <>
              <label className="label">{t('name')}</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                required
              />
            </>
          )}

          <label className="label">{t('email')}</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            required
          />

          <label className="label">{t('password')}</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            minLength={6}
            required
          />

          <button className="btn" style={{ marginTop: 18 }} disabled={loading}>
            {loading ? t('wait') : mode === 'login' ? t('signIn') : t('createAccount')}
          </button>

          {error && <p className="error-msg">{error}</p>}
          {msg && <p className="success-msg">{msg}</p>}
        </form>

        <p className="muted" style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
          {mode === 'login' ? t('noAccount') : t('haveAccount')}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setMsg('');
            }}
            style={{ background: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}
          >
            {mode === 'login' ? t('signUp') : t('signIn')}
          </button>
        </p>
      </div>
    </div>
  );
}
