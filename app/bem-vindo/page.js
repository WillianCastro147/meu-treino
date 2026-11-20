'use client';

// Volta da Stripe depois do pagamento (success_url): confirma a sessão e abre o cadastro
// com o e-mail da compra. Quem já está logado segue para /preparando.
// Volta da Hotmart (página de obrigado, sem session_id): abre o cadastro direto.
// Se a compra foi o acesso vitalício e ficou de fora algum extra (plano alimentar, gerador de treino com IA),
// mostra antes as ofertas dos que faltaram, uma de cada vez (upsell, um pagamento à parte): plano alimentar e,
// para quem recusar, o gerador de treino com IA. "Não, obrigado" na última segue para o cadastro.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { IconLogo } from '@/components/Icons';
import { useI18n } from '@/lib/i18n';

// Quiz em espanhol (quiz.moviqgym.app/es): a Stripe volta com ?lang=es, que também deixa o app em espanhol.
// As ofertas de extra abaixo são só do quiz em português (vitalício em reais), então aqui só os avisos.
const AVISOS = {
  pt: { confirmando: 'Confirmando seu pagamento…', confirmado: 'Pagamento confirmado! Agora crie sua conta com o mesmo e-mail.', titulo: 'Bem-vindo ao Moviq!' },
  es: { confirmando: 'Confirmando tu pago…', confirmado: '¡Pago confirmado! Ahora crea tu cuenta con el mismo correo.', titulo: '¡Bienvenido a Moviq!' },
};

const OFERTAS = {
  plano_alimentar: {
    titulo: 'Quer acelerar o resultado com um plano alimentar?',
    sub: 'O treino faz a parte dele. A alimentação certa faz o resultado aparecer mais rápido.',
    beneficios: [
      'Calorias, proteínas, carboidratos e gorduras do seu dia, calculados pelo seu objetivo, peso e treinos',
      '5 refeições com opções de comida do dia a dia: arroz, feijão, frango, ovos, tapioca, frutas',
      'Quantidades em gramas ajustadas para você, para trocar à vontade',
      'Fica no app junto com o seu treino',
    ],
    botao: 'Quero o plano alimentar',
    aviso: 'Estimativa geral a partir das suas respostas do quiz. Não substitui a orientação de um nutricionista.',
  },
  gerador_ia: {
    titulo: 'Quer criar treinos novos com IA sempre que quiser?',
    sub: 'Seu primeiro plano já vem pronto. Com o gerador, você monta um treino novo quando enjoar, mudar de objetivo ou de academia.',
    beneficios: [
      'Treinos novos montados pela IA em segundos, com o seu objetivo, nível, dias e tempo',
      'Escolha o equipamento: academia completa, em casa ou só o peso do corpo',
      'Novos Desafios 21 dias de calistenia gerados para o seu nível',
      'Até 5 treinos novos por dia',
    ],
    botao: 'Quero o gerador de treino com IA',
    aviso: '',
  },
};

export default function BemVindoPage() {
  const router = useRouter();
  const { lang } = useI18n();
  const av = AVISOS[lang === 'es' ? 'es' : 'pt'];
  const [msg, setMsg] = useState(''); // vazio = "confirmando" no idioma da tela
  const [ofertas, setOfertas] = useState([]); // [{ plano, nome, preco, url }], uma de cada vez
  const [cadastro, setCadastro] = useState('');
  const oferta = ofertas[0] || null;

  // "Não, obrigado": próxima oferta (plano alimentar → gerador com IA) ou, se acabou, o cadastro
  const recusar = () => {
    if (ofertas.length > 1) {
      setOfertas(ofertas.slice(1));
      window.scrollTo(0, 0);
    } else router.replace(cadastro);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return router.replace('/preparando');

      const params = new URLSearchParams(window.location.search);
      const id = params.get('session_id') || '';
      let info = {};
      if (id) {
        try {
          const res = await fetch(`/api/stripe/sessao?session_id=${encodeURIComponent(id)}`);
          if (res.ok) info = await res.json();
        } catch (e) {}
      } else {
        // Volta da Hotmart (página de obrigado): não há sessão para confirmar. O acesso é liberado pelo
        // aviso da Hotmart (/api/hotmart/webhook) quando o pagamento cai; aqui só abre o cadastro,
        // com o e-mail e o nome se a Hotmart mandar na URL.
        info = { email: params.get('email') || '', name: params.get('name') || params.get('nome') || '' };
        setMsg('Compra recebida! Agora crie sua conta com o mesmo e-mail da compra. O acesso é liberado assim que o pagamento for confirmado.');
        const q = new URLSearchParams({ modo: 'cadastro' });
        if (info.email) q.set('email', info.email);
        if (info.name) q.set('name', String(info.name).trim().split(/\s+/)[0]);
        setTimeout(() => router.replace(`/login?${q}`), 3500);
        return;
      }
      const q = new URLSearchParams({ modo: 'cadastro' });
      if (info.email) q.set('email', info.email);
      if (info.name) q.set('name', String(info.name).trim().split(/\s+/)[0]);
      const destino = `/login?${q}`;

      // Volta de um checkout de oferta sem pagar (depois=<plano>): segue para as ofertas seguintes
      let lista = params.get('sem_oferta') ? [] : info.upsells || (info.upsell ? [info.upsell] : []);
      const depois = params.get('depois');
      if (depois) lista = lista.slice(lista.findIndex((o) => o.plano === depois) + 1);
      if (lista.length) {
        setCadastro(destino);
        setOfertas(lista);
        return;
      }
      setMsg(
        params.get('lang') === 'es'
          ? AVISOS.es.confirmado
          : info.plano === 'plano_alimentar' || info.plano === 'gerador_ia'
            ? 'Compra confirmada! Agora crie sua conta com o mesmo e-mail.'
            : AVISOS.pt.confirmado
      );
      setTimeout(() => router.replace(destino), 1200);
    })();
  }, [router]);

  if (oferta) {
    const o = OFERTAS[oferta.plano] || OFERTAS.plano_alimentar;
    return (
      <div className="auth-wrap">
        <div className="auth-box">
          <div style={{ textAlign: 'center' }}>
            <IconLogo size={40} />
            <p className="muted" style={{ marginTop: 10, fontSize: 14 }}>
              ✓ Pagamento confirmado. Seu acesso ao Moviq está liberado.
            </p>
            <h1 className="quiz-title" style={{ marginTop: 14 }}>
              {o.titulo}
            </h1>
            <p className="quiz-sub">{o.sub}</p>
          </div>
          <ul className="card" style={{ listStyle: 'none', display: 'grid', gap: 12, margin: '18px 0', padding: 18 }}>
            {o.beneficios.map((b) => (
              <li key={b} style={{ display: 'flex', gap: 10, fontSize: 15, lineHeight: 1.4 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <p style={{ textAlign: 'center', margin: '0 0 14px' }}>
            <b style={{ fontSize: 42, lineHeight: 1.1, letterSpacing: -0.5, display: 'block' }}>{oferta.preco}</b>
            <span className="muted" style={{ display: 'block', fontSize: 14 }}>
              pagamento único, no Pix ou no cartão
            </span>
          </p>
          <a className="btn" href={oferta.url} style={{ display: 'block', textAlign: 'center' }}>
            {o.botao}
          </a>
          <button className="btn secondary" style={{ marginTop: 10, width: '100%' }} onClick={recusar}>
            {ofertas.length > 1 ? 'Não, obrigado' : 'Não, obrigado. Continuar para o app'}
          </button>
          {o.aviso ? (
            <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
              {o.aviso}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box" style={{ textAlign: 'center' }}>
        <IconLogo size={44} />
        <h1 className="quiz-title" style={{ marginTop: 14 }}>
          {av.titulo}
        </h1>
        <p className="quiz-sub">{msg || av.confirmando}</p>
      </div>
    </div>
  );
}
