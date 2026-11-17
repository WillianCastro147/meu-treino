'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';

// Bloqueio por assinatura (Stripe): só vale com NEXT_PUBLIC_EXIGIR_ASSINATURA=1 na Vercel.
// A conta precisa de uma linha ativa (ou 'cortesia') na tabela assinaturas (migração 006).
const EXIGIR = process.env.NEXT_PUBLIC_EXIGIR_ASSINATURA === '1';
const PLANOS_URL = process.env.NEXT_PUBLIC_PLANOS_URL || 'https://quiz.moviqgym.app';
const CACHE = 'moviq_acesso_v1'; // resultado positivo guardado por 10 min (evita checar a cada página)

const TXT = {
  pt: { title: 'Sua assinatura não está ativa', text: 'Para usar o Moviq, assine com o mesmo e-mail desta conta:', plans: 'Ver planos', retry: 'Já assinei, verificar de novo', out: 'Sair', checking: 'Verificando…' },
  en: { title: 'Your subscription is not active', text: 'To use Moviq, subscribe with the same email as this account:', plans: 'See plans', retry: 'I already subscribed, check again', out: 'Sign out', checking: 'Checking…' },
  es: { title: 'Tu suscripción no está activa', text: 'Para usar Moviq, suscríbete con el mismo correo de esta cuenta:', plans: 'Ver planes', retry: 'Ya me suscribí, verificar de nuevo', out: 'Salir', checking: 'Verificando…' },
  fr: { title: "Votre abonnement n'est pas actif", text: "Pour utiliser Moviq, abonnez-vous avec l'e-mail de ce compte :", plans: 'Voir les offres', retry: 'Je suis déjà abonné, vérifier', out: 'Se déconnecter', checking: 'Vérification…' },
};

async function checkAccess(userId) {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE) || 'null');
    if (c && c.id === userId && Date.now() - c.at < 10 * 60 * 1000) return true;
  } catch (e) {}
  const { data, error } = await supabase.rpc('tem_acesso');
  // Função ainda não criada (migração 006 não rodou): não tranca ninguém
  if (error && /tem_acesso|PGRST202|42883/.test(`${error.code} ${error.message}`)) return true;
  const ok = !error && data === true;
  if (ok) {
    try {
      sessionStorage.setItem(CACHE, JSON.stringify({ id: userId, at: Date.now() }));
    } catch (e) {}
  }
  return ok;
}

export default function AuthGuard({ children }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(EXIGIR ? null : true); // null = verificando

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          router.replace('/login');
        } else {
          setUser(session.user);
        }
        setLoading(false);
      })
      .catch(() => router.replace('/login'));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login');
      else setUser(session.user);
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (EXIGIR && user) checkAccess(user.id).then(setAccess);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !user || access === null) {
    return (
      <div className="auth-wrap">
        <p className="muted">{t('loading')}</p>
      </div>
    );
  }

  if (!access) {
    const x = TXT[lang] || TXT.pt;
    return (
      <div className="auth-wrap">
        <div className="auth-box" style={{ textAlign: 'center' }}>
          <h1 className="quiz-title">{x.title}</h1>
          <p className="quiz-sub">
            {x.text}
            <br />
            <b style={{ color: 'var(--text)' }}>{user.email}</b>
          </p>
          {PLANOS_URL && (
            <a className="btn" href={PLANOS_URL} style={{ marginBottom: 10 }}>
              {x.plans}
            </a>
          )}
          <button
            className="btn secondary"
            onClick={() => {
              setAccess(null);
              checkAccess(user.id).then(setAccess);
            }}
          >
            {x.retry}
          </button>
          <button className="link-btn" style={{ marginTop: 16 }} onClick={() => supabase.auth.signOut()}>
            {x.out}
          </button>
        </div>
      </div>
    );
  }

  return children(user);
}
