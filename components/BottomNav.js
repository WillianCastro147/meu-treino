'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { loadActive, activeUrl } from '@/lib/activeWorkout';
import StartSheet from '@/components/StartSheet';
import { IconCalendar, IconChart, IconDumbbell, IconList } from '@/components/Icons';

const IconHome = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

// Início · Plano · ▶ Iniciar · Progresso · Exercícios (mesma ordem do openGym).
// Configurações (/perfil) fica dentro do Início.
const left = [
  { href: '/inicio', label: 'tabHome', Icon: IconHome, also: ['/perfil'] },
  { href: '/treino', label: 'tabPlan', Icon: IconCalendar },
];
const right = [
  { href: '/estatisticas', label: 'tabStats', Icon: IconChart },
  { href: '/exercicios', label: 'tabExercises', Icon: IconList },
];

// Campos que abrem o teclado (não conta checkbox, botão, select etc.)
const NO_KEYBOARD = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color', 'image', 'hidden'];
function opensKeyboard(el) {
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !NO_KEYBOARD.includes((el.type || 'text').toLowerCase());
}

// true enquanto o teclado do celular está aberto: campo de texto em foco numa tela de toque,
// ou a área visível encolheu bastante (visualViewport), o que pega também o teclado do Android.
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    if (!touch) return;
    const vv = window.visualViewport;
    const check = () => {
      const focused = opensKeyboard(document.activeElement);
      const shrunk = vv ? window.innerHeight - vv.height > 150 : false;
      setOpen(focused || shrunk);
    };
    // no focusout o foco ainda não passou para o próximo campo: confere logo depois
    const later = () => setTimeout(check, 50);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', later);
    vv?.addEventListener('resize', check);
    check();
    return () => {
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', later);
      vv?.removeEventListener('resize', check);
    };
  }, []);
  return open;
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [active, setActive] = useState(null);
  const [showStart, setShowStart] = useState(false);

  useEffect(() => {
    setActive(loadActive());
  }, [pathname]);

  // Teclado aberto no celular: esconde a barra. Senão, ao rolar com o teclado aberto,
  // ela fica "flutuando" no meio da tela (o iPhone prende o fixed atrás do teclado).
  const keyboard = useKeyboardOpen();

  const isOn = (tab) => [tab.href, ...(tab.also || [])].some((h) => pathname.startsWith(h));
  const tabLink = (tab) => (
    <Link key={tab.href} href={tab.href} className={isOn(tab) ? 'active' : ''}>
      <tab.Icon size={24} />
      {t(tab.label)}
    </Link>
  );

  return (
    <>
      <nav className={`bottom-nav ${keyboard ? 'kb-open' : ''}`}>
        {left.map(tabLink)}
        <button
          className={`nav-start ${active ? 'rec' : ''}`}
          onClick={() => (active ? router.push(activeUrl(active)) : setShowStart(true))}
        >
          <span className="nav-start-circle">
            <IconDumbbell size={28} color="#fff" />
          </span>
          {active ? t('tabResume') : t('tabStart')}
        </button>
        {right.map(tabLink)}
      </nav>
      {showStart && <StartSheet onClose={() => setShowStart(false)} />}
    </>
  );
}
