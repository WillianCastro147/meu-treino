'use client';

// Tela "Instale o Moviq": aparece depois que o plano fica pronto (/preparando) e pelo lembrete do Início.
// Sem login obrigatório: também pode ser aberta pelo link do e-mail de boas-vindas.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLogo } from '@/components/Icons';
import { useI18n } from '@/lib/i18n';
import { useInstall, dismissInstall } from '@/lib/install';

const APP_HOST = 'www.moviqgym.app';

const TXT = {
  pt: {
    title: 'Instale o Moviq no seu celular',
    sub: 'Ele fica na sua tela inicial, abre em tela cheia e você não perde o acesso.',
    installBtn: 'Instalar app',
    installed: 'O Moviq já está instalado neste aparelho.',
    androidMenu: ['Toque no menu ⋮ do Chrome (canto superior direito).', 'Toque em "Instalar app" ou "Adicionar à tela inicial".', 'Confirme. O ícone do Moviq aparece na tela inicial.'],
    ios: ['Toque no botão Compartilhar (quadrado com seta para cima). No iOS mais novo, ele fica dentro do menu ⋯.', 'Role a lista e toque em "Adicionar à Tela de Início".', 'Toque em "Adicionar". Pronto: o Moviq vira um app na sua tela.'],
    iosSafari: 'Faça isso no Safari.',
    inapp: 'Você está dentro do navegador do Instagram/Facebook, que não instala apps. Abra o Moviq no Safari (iPhone) ou no Chrome (Android):',
    copy: 'Copiar link',
    copied: 'Link copiado! Cole no Safari ou no Chrome.',
    desktop: 'Abra este endereço no navegador do seu celular para instalar:',
    keep: 'Guarde este endereço:',
    later: 'Agora não',
    go: 'Continuar',
  },
  en: {
    title: 'Install Moviq on your phone',
    sub: 'It stays on your home screen, opens full screen and you never lose access.',
    installBtn: 'Install app',
    installed: 'Moviq is already installed on this device.',
    androidMenu: ['Tap the Chrome menu ⋮ (top right).', 'Tap "Install app" or "Add to Home screen".', 'Confirm. The Moviq icon appears on your home screen.'],
    ios: ['Tap the Share button (square with an up arrow). On newer iOS it is inside the ⋯ menu.', 'Scroll and tap "Add to Home Screen".', 'Tap "Add". Done.'],
    iosSafari: 'Do this in Safari.',
    inapp: 'You are inside the Instagram/Facebook browser, which cannot install apps. Open Moviq in Safari (iPhone) or Chrome (Android):',
    copy: 'Copy link',
    copied: 'Link copied! Paste it in Safari or Chrome.',
    desktop: 'Open this address on your phone to install:',
    keep: 'Save this address:',
    later: 'Not now',
    go: 'Continue',
  },
};
TXT.es = TXT.en;
TXT.fr = TXT.en;

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px' }}>
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function Steps({ items }) {
  return (
    <ol className="install-steps">
      {items.map((s, i) => (
        <li key={i}>
          <span className="install-num">{i + 1}</span>
          <span>
            {s}
            {i === 0 && s.includes('Compartilhar') ? (
              <>
                {' '}
                <ShareIcon />
              </>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function InstalarPage() {
  const router = useRouter();
  const { lang } = useI18n();
  const x = TXT[lang] || TXT.pt;
  const { ready, standalone, platform, canPrompt, prompt } = useInstall();
  const [copied, setCopied] = useState(false);

  const next = () => {
    const n = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
    router.replace(n && n.startsWith('/') && !n.startsWith('//') ? n : '/');
  };

  async function copyLink() {
    const url = `https://${APP_HOST}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      window.prompt('', url);
    }
    setCopied(true);
  }

  if (!ready) return <div className="auth-wrap" />;

  return (
    <div className="auth-wrap">
      <div className="auth-box install-box">
        <div style={{ textAlign: 'center' }}>
          <img src="/icon-192.png" alt="" width="72" height="72" className="install-icon" />
          <h1 className="quiz-title" style={{ marginTop: 12 }}>
            {x.title}
          </h1>
          <p className="quiz-sub">{x.sub}</p>
        </div>

        {standalone ? (
          <p className="install-ok">✓ {x.installed}</p>
        ) : platform === 'inapp' ? (
          <>
            <p className="install-text">{x.inapp}</p>
            <button className="btn" onClick={copyLink}>
              {x.copy}
            </button>
            {copied && <p className="install-ok">{x.copied}</p>}
          </>
        ) : platform === 'ios' ? (
          <>
            <p className="install-text">
              <b>{x.iosSafari}</b>
            </p>
            <Steps items={x.ios} />
          </>
        ) : platform === 'android' ? (
          canPrompt ? (
            <button
              className="btn"
              onClick={async () => {
                if ((await prompt()) === 'accepted') next();
              }}
            >
              <IconLogo size={20} color="#fff" /> {x.installBtn}
            </button>
          ) : (
            <Steps items={x.androidMenu} />
          )
        ) : (
          <>
            <p className="install-text">{x.desktop}</p>
            {canPrompt && (
              <button className="btn" onClick={() => prompt()}>
                {x.installBtn}
              </button>
            )}
          </>
        )}

        <p className="install-keep">
          {x.keep} <b>{APP_HOST}</b>
        </p>

        <button
          className="btn secondary"
          style={{ marginTop: 6 }}
          onClick={() => {
            if (!standalone) dismissInstall();
            next();
          }}
        >
          {standalone ? x.go : x.later}
        </button>
      </div>
    </div>
  );
}
