'use client';

// Volta da Stripe depois do pagamento (success_url): confirma a sessão e abre o cadastro
// com o e-mail da compra. Quem já está logado segue para /preparando.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { IconLogo } from '@/components/Icons';

export default function BemVindoPage() {
  const router = useRouter();
  const [msg, setMsg] = useState('Confirmando seu pagamento…');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return router.replace('/preparando');

      const id = new URLSearchParams(window.location.search).get('session_id') || '';
      let email = '';
      let name = '';
      try {
        const res = await fetch(`/api/stripe/sessao?session_id=${encodeURIComponent(id)}`);
        if (res.ok) ({ email = '', name = '' } = await res.json());
      } catch (e) {}
      setMsg('Pagamento confirmado! Agora crie sua conta com o mesmo e-mail.');
      const q = new URLSearchParams({ modo: 'cadastro' });
      if (email) q.set('email', email);
      if (name) q.set('name', String(name).trim().split(/\s+/)[0]);
      setTimeout(() => router.replace(`/login?${q}`), 1200);
    })();
  }, [router]);

  return (
    <div className="auth-wrap">
      <div className="auth-box" style={{ textAlign: 'center' }}>
        <IconLogo size={44} />
        <h1 className="quiz-title" style={{ marginTop: 14 }}>
          Bem-vindo ao Moviq!
        </h1>
        <p className="quiz-sub">{msg}</p>
      </div>
    </div>
  );
}
