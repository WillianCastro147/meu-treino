'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { IconLogo } from '@/components/Icons';

// Tela aberta pelo link de "Esqueci minha senha" enviado por e-mail
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [hasSession, setHasSession] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // O Supabase lê o token do link e cria a sessão de recuperação
    const check = () =>
      supabase.auth.getSession().then(({ data: { session } }) => setHasSession(!!session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setHasSession(true);
    });
    const timer = setTimeout(check, 600);
    return () => {
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message.includes('at least 6') ? t('errShort') : t('errPrefix') + error.message);
    } else {
      setDone(true);
      setTimeout(() => router.replace('/inicio'), 1500);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
          <IconLogo size={36} />
          <h1 style={{ fontSize: 30, fontWeight: 800, textAlign: 'center' }}>{t('resetTitle')}</h1>
        </div>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 24, fontSize: 15 }}>
          {t('resetSubtitle')}
        </p>

        {hasSession === null && <p className="muted" style={{ textAlign: 'center' }}>{t('loading')}</p>}

        {hasSession === false && (
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="error-msg" style={{ marginTop: 0 }}>{t('resetInvalid')}</p>
            <button className="btn" style={{ marginTop: 14 }} onClick={() => router.replace('/login')}>
              {t('backToLogin')}
            </button>
          </div>
        )}

        {hasSession && (
          <form onSubmit={handleSubmit} className="card">
            <label className="label">{t('newPassword')}</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              minLength={6}
              required
            />
            <button className="btn" style={{ marginTop: 18 }} disabled={loading || done}>
              {loading ? t('wait') : t('savePassword')}
            </button>
            {error && <p className="error-msg">{error}</p>}
            {done && <p className="success-msg">{t('passwordUpdated')}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
