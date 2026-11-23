'use client';

// Guia de Treino Feminino (ebook em PDF, produto extra). Com a compra liberada: botão para baixar o PDF
// (link temporário do /api/guia). Sem a compra: a oferta com o botão de pagamento.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { IconBack } from '@/components/Icons';
import { supabase } from '@/lib/supabase';

const CONTEUDO = [
  '+83 exercícios passo a passo, 100% ilustrados, com a posição inicial e a final',
  '8 capítulos: glúteos, quadríceps, posteriores, costas, ombros, peito, braços e core',
  'Em cada exercício: como fazer, o que sentir, quanto peso usar e os erros mais comuns',
  'Ebook em PDF de 95 páginas para consultar no celular, na academia',
];

export default function GuiaPage() {
  return <AuthGuard>{(user) => <Guia user={user} />}</AuthGuard>;
}

function Guia({ user }) {
  const router = useRouter();
  const [estado, setEstado] = useState('carregando'); // carregando | oferta | liberado | erro
  const [info, setInfo] = useState({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      try {
        const res = await fetch('/api/guia', { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json();
        if (body.liberado) {
          setInfo(body);
          return setEstado(body.url ? 'liberado' : 'erro');
        }
        if (!res.ok) return setEstado('erro');
        setInfo(body);
        setEstado('oferta');
      } catch (e) {
        setEstado('erro');
      }
    })();
  }, []);

  const comprar = () => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/stripe/checkout';
    for (const [k, v] of Object.entries({ plano: 'guia_feminino', email: user.email || '' })) {
      const i = document.createElement('input');
      i.type = 'hidden';
      i.name = k;
      i.value = v;
      form.append(i);
    }
    document.body.append(form);
    form.submit();
  };

  return (
    <div className="page">
      <div className="page-head" style={{ justifyContent: 'flex-start', gap: 12 }}>
        <button className="round-btn" onClick={() => router.back()} aria-label="Voltar">
          <IconBack />
        </button>
      </div>
      <PageHeader title="Guia de Treino Feminino" sub="Ebook de 95 páginas" />
      <img
        src="/img/guia-feminino-mockup-720.webp"
        alt="Ebook Treino Feminino: Guia Completo, com páginas de exercícios ilustrados"
        width={720}
        height={667}
        style={{ display: 'block', width: '62%', maxWidth: 240, height: 'auto', margin: '0 auto 14px' }}
      />

      {estado === 'carregando' && <p className="muted">Carregando…</p>}
      {estado === 'erro' && <p className="muted">Não foi possível abrir o guia agora. Tente de novo em instantes.</p>}

      {estado === 'liberado' && (
        <div className="card">
          <p style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Seu guia está liberado</p>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.45, marginBottom: 16 }}>
            Toque no botão para abrir o PDF. No celular, use &quot;Compartilhar&quot; ou &quot;Baixar&quot; para guardar e ler quando quiser.
          </p>
          <a className="btn" href={info.url} target="_blank" rel="noopener" style={{ display: 'flex', width: '100%' }}>
            Baixar o guia (PDF)
          </a>
        </div>
      )}

      {(estado === 'oferta' || estado === 'liberado') && (
        <div className="card">
          <b style={{ fontSize: 17 }}>O que tem no guia</b>
          <ul style={{ listStyle: 'none', display: 'grid', gap: 10, margin: '12px 0 4px', padding: 0 }}>
            {CONTEUDO.map((b) => (
              <li key={b} style={{ display: 'flex', gap: 10, fontSize: 15 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {estado === 'oferta' &&
            (info.oferta?.preco ? (
              <>
                <p style={{ margin: '14px 0 12px' }}>
                  <b style={{ fontSize: 24 }}>{info.oferta.preco}</b> <span className="muted">pagamento único, Pix ou cartão</span>
                </p>
                <button className="btn" style={{ width: '100%' }} onClick={comprar}>
                  Quero o guia feminino
                </button>
              </>
            ) : (
              <p className="muted">Em breve.</p>
            ))}
        </div>
      )}
      <BottomNav />
    </div>
  );
}
