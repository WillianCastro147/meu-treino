'use client';

// Lembrete no Início para instalar o Moviq na tela inicial (some depois de instalado ou por 3 dias após o "x")
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useInstall, installDismissedRecently, dismissInstall } from '@/lib/install';

const TXT = {
  pt: { title: 'Instale o Moviq na tela inicial', sub: 'Abra como app e não perca o acesso.' },
  en: { title: 'Install Moviq on your home screen', sub: 'Open it like an app and never lose access.' },
};

export default function InstallBanner() {
  const { lang } = useI18n();
  const { ready, standalone, platform } = useInstall();
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(installDismissedRecently()), []);

  if (!ready || standalone || hidden || platform === 'desktop') return null;
  const x = TXT[lang] || TXT.en;

  return (
    <div className="install-banner">
      <img src="/icon-192.png" alt="" width="40" height="40" />
      <Link href="/instalar?next=/inicio" style={{ flex: 1, minWidth: 0 }}>
        <b>{x.title}</b>
        <small>{x.sub}</small>
      </Link>
      <button
        className="x"
        aria-label="Fechar"
        onClick={() => {
          dismissInstall();
          setHidden(true);
        }}
      >
        ×
      </button>
    </div>
  );
}
