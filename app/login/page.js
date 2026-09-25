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
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
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

  function switchMode(m) {
    setMode(m);
    setError('');
    setMsg('');
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
      } else if (mode === 'signup') {
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
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) setError(translateError(error.message));
        else setMsg(t('resetSent'));
      }
    } catch (err) {
      setError(translateError(err?.message));
    }
    setLoading(false);
  }

  const subtitle =
    mode === 'login' ? t('loginSubtitle') : mode === 'signup' ? t('signupSubtitle') : t('forgotSubtitle');
  const submitLabel =
    mode === 'login' ? t('signIn') : mode === 'signup' ? t('createAccount') : t('sendResetLink');

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <LangSwitcher style={{ margin: '0 auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
          <IconLogo size={36} />
          <h1 style={{ fontSize: 34, fontWeight: 800, textAlign: 'center' }}>Moviq</h1>
        </div>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 24, fontSize: 15 }}>
          {subtitle}
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
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            required
          />

          {mode !== 'forgot' && (
            <>
              <label className="label">{t('password')}</label>
              <input
                className="input"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                minLength={6}
                required
              />
            </>
          )}

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <button type="button" className="link-btn" onClick={() => switchMode('forgot')}>
                {t('forgotPassword')}
              </button>
            </div>
          )}

          <button className="btn" style={{ marginTop: 18 }} disabled={loading}>
            {loading ? t('wait') : submitLabel}
          </button>

          {error && <p className="error-msg">{error}</p>}
          {msg && <p className="success-msg">{msg}</p>}
        </form>

        {mode === 'forgot' ? (
          <p style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="button" className="link-btn" onClick={() => switchMode('login')}>
              ← {t('backToLogin')}
            </button>
          </p>
        ) : (
          <p className="muted" style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
            {mode === 'login' ? t('noAccount') : t('haveAccount')}{' '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              style={{ background: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}
            >
              {mode === 'login' ? t('signUp') : t('signIn')}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
