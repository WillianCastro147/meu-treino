'use client';

// Volta da Stripe depois do pagamento (success_url): confirma a sessão e abre o cadastro
// com o e-mail da compra. Quem já está logado segue para /preparando.
// Se a compra foi o acesso vitalício sem o plano alimentar, mostra antes a oferta do plano alimentar
// (upsell, um pagamento à parte). "Não, obrigado" segue para o cadastro.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { IconLogo } from '@/components/Icons';

const BENEFICIOS = [
  'Calorias, proteínas, carboidratos e gorduras do seu dia, calculados pelo seu objetivo, peso e treinos',
  '5 refeições com opções de comida do dia a dia: arroz, feijão, frango, ovos, tapioca, frutas',
  'Quantidades em gramas ajustadas para você, para trocar à vontade',
  'Fica no app junto com o seu treino',
];

export default function BemVindoPage() {
  const router = useRouter();
  const [msg, setMsg] = useState('Confirmando seu pagamento…');
  const [oferta, setOferta] = useState(null); // { preco, url }
  const [cadastro, setCadastro] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return router.replace('/preparando');

      const params = new URLSearchParams(window.location.search);
      const id = params.get('session_id') || '';
      let info = {};
      try {
        const res = await fetch(`/api/stripe/sessao?session_id=${encodeURIComponent(id)}`);
        if (res.ok) info = await res.json();
      } catch (e) {}
      const q = new URLSearchParams({ modo: 'cadastro' });
      if (info.email) q.set('email', info.email);
      if (info.name) q.set('name', String(info.name).trim().split(/\s+/)[0]);
      const destino = `/login?${q}`;

      if (info.upsell && !params.get('sem_oferta')) {
        setCadastro(destino);
        setOferta(info.upsell);
        return;
      }
      setMsg(
        info.plano === 'plano_alimentar'
          ? 'Plano alimentar confirmado! Agora crie sua conta com o mesmo e-mail.'
          : 'Pagamento confirmado! Agora crie sua conta com o mesmo e-mail.'
      );
      setTimeout(() => router.replace(destino), 1200);
    })();
  }, [router]);

  if (oferta) {
    return (
      <div className="auth-wrap">
        <div className="auth-box">
          <div style={{ textAlign: 'center' }}>
            <IconLogo size={40} />
            <p className="muted" style={{ marginTop: 10, fontSize: 14 }}>
              ✓ Pagamento confirmado. Seu acesso ao Moviq está liberado.
            </p>
            <h1 className="quiz-title" style={{ marginTop: 14 }}>
              Quer acelerar o resultado com um plano alimentar?
            </h1>
            <p className="quiz-sub">O treino faz a parte dele. A alimentação certa faz o resultado aparecer mais rápido.</p>
          </div>
          <ul className="card" style={{ listStyle: 'none', display: 'grid', gap: 12, margin: '18px 0', padding: 18 }}>
            {BENEFICIOS.map((b) => (
              <li key={b} style={{ display: 'flex', gap: 10, fontSize: 15, lineHeight: 1.4 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <p style={{ textAlign: 'center', margin: '0 0 14px' }}>
            <b style={{ fontSize: 26 }}>{oferta.preco}</b>
            <span className="muted" style={{ display: 'block', fontSize: 14 }}>
              pagamento único, no Pix ou no cartão
            </span>
          </p>
          <a className="btn" href={oferta.url} style={{ display: 'block', textAlign: 'center' }}>
            Quero o plano alimentar
          </a>
          <button className="btn secondary" style={{ marginTop: 10, width: '100%' }} onClick={() => router.replace(cadastro)}>
            Não, obrigado. Continuar para o app
          </button>
          <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
            Estimativa geral a partir das suas respostas do quiz. Não substitui a orientação de um nutricionista.
          </p>
        </div>
      </div>
    );
  }

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
