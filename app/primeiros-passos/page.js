'use client';

// Primeiros passos depois da compra: o link {link} da mensagem de compra confirmada do WhatsApp (LeonaFlow,
// fluxo "Comprou", template moviq_compra_confirmada) abre esta página, para Stripe e Hotmart.
//   /primeiros-passos?email=<e-mail da compra>
// 1) criar a conta com o e-mail da compra (o cadastro já vem preenchido), 2) instalar na tela inicial,
// 3) o que fazer se aparecer "Sua assinatura não está ativa". Sem login. Só em português (quiz em português).
import { useEffect, useState } from 'react';
import { IconLogo } from '@/components/Icons';
import { useI18n } from '@/lib/i18n';
import { useInstall } from '@/lib/install';

const APP_HOST = 'www.moviqgym.app';

const IOS = [
  'Abra o Moviq no Safari. Se abriu dentro do WhatsApp, toque no ícone da bússola ou em "Abrir no Safari".',
  'Toque no botão Compartilhar (quadrado com seta para cima). No iOS mais novo, ele fica dentro do menu ⋯.',
  'Role a lista e toque em "Adicionar à Tela de Início", depois em "Adicionar".',
];
const ANDROID = [
  'Abra o Moviq no Chrome. Se abriu dentro do WhatsApp, toque no menu ⋮ e em "Abrir no Chrome".',
  'Toque no menu ⋮ do Chrome (canto superior direito).',
  'Toque em "Instalar app" ou "Adicionar à tela inicial" e confirme.',
];

function Passos({ itens }) {
  return (
    <ol className="install-steps">
      {itens.map((s, i) => (
        <li key={i}>
          <span className="install-num">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Titulo({ n, children }) {
  return (
    <p className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, textAlign: 'left' }}>
      <span className="install-num">{n}</span>
      {children}
    </p>
  );
}

export default function PrimeirosPassosPage() {
  const { setLang } = useI18n();
  const { ready, standalone, platform, canPrompt, prompt } = useInstall();
  const [email, setEmail] = useState('');
  const [instalado, setInstalado] = useState(false);

  useEffect(() => {
    setLang('pt');
    setEmail(String(new URLSearchParams(window.location.search).get('email') || '').trim().toLowerCase());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cadastro = `/login?${new URLSearchParams(email ? { modo: 'cadastro', email } : { modo: 'cadastro' })}`;
  const entrar = `/login?${new URLSearchParams(email ? { email } : {})}`;

  if (!ready) return <div className="auth-wrap" />;

  return (
    <div className="auth-wrap">
      <div className="auth-box install-box" style={{ maxWidth: 480 }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/icon-192.png" alt="" width="72" height="72" className="install-icon" />
          <h1 className="quiz-title" style={{ marginTop: 12 }}>
            Bem-vindo ao Moviq!
          </h1>
          <p className="quiz-sub">Seu acesso está liberado. Faltam só 2 passos para começar a treinar.</p>
        </div>

        {/* 1. Conta */}
        <div className="card" style={{ marginTop: 8 }}>
          <Titulo n={1}>Crie sua conta</Titulo>
          <p className="install-text" style={{ marginTop: 0, textAlign: 'left' }}>
            Use o <b>mesmo e-mail do pagamento</b>
            {email ? (
              <>
                : <b style={{ wordBreak: 'break-all' }}>{email}</b>
              </>
            ) : null}
            . É por ele que o acesso é liberado e o seu plano do quiz aparece pronto.
          </p>
          <a className="btn" href={cadastro} style={{ display: 'flex', width: '100%' }}>
            Criar minha conta
          </a>
          <p className="muted" style={{ textAlign: 'center', fontSize: 14, marginTop: 10 }}>
            Já criou? <a href={entrar}>Entrar</a>
          </p>
        </div>

        {/* 2. Tela inicial */}
        <div className="card">
          <Titulo n={2}>Coloque o Moviq na tela inicial</Titulo>
          {standalone || instalado ? (
            <p className="install-ok">✓ O Moviq já está instalado neste aparelho.</p>
          ) : platform === 'android' && canPrompt ? (
            <button
              className="btn"
              style={{ width: '100%' }}
              onClick={async () => {
                if ((await prompt()) === 'accepted') setInstalado(true);
              }}
            >
              <IconLogo size={20} color="#fff" /> Instalar app
            </button>
          ) : platform === 'ios' ? (
            <Passos itens={IOS} />
          ) : platform === 'android' ? (
            <Passos itens={ANDROID} />
          ) : (
            <>
              <p className="install-text" style={{ marginTop: 0 }}>
                <b>iPhone</b>
              </p>
              <Passos itens={IOS} />
              <p className="install-text">
                <b>Android</b>
              </p>
              <Passos itens={ANDROID} />
            </>
          )}
          <p className="muted" style={{ fontSize: 14, marginTop: 10, textAlign: 'left' }}>
            O Moviq abre como um app, em tela cheia, direto do ícone. Na primeira vez, entre com o mesmo e-mail e senha.
          </p>
        </div>

        {/* 3. Ajuda */}
        <div className="card">
          <p className="card-title" style={{ textAlign: 'left' }}>
            Apareceu &quot;Sua assinatura não está ativa&quot;?
          </p>
          <Passos
            itens={[
              'Confira se a conta foi criada com o mesmo e-mail do pagamento.',
              'No Pix, o acesso é liberado assim que o pagamento é confirmado. Depois toque em "Já assinei, verificar de novo".',
              'Se ainda assim não liberar, responda a mensagem do WhatsApp que a gente resolve.',
            ]}
          />
        </div>

        <p className="install-keep">
          Guarde este endereço: <b>{APP_HOST}</b>
        </p>
        <p className="muted" style={{ textAlign: 'center', fontSize: 12.5 }}>
          Acesso vitalício com pagamento único · 7 dias de garantia
        </p>
      </div>
    </div>
  );
}
