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

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [active, setActive] = useState(null);
  const [showStart, setShowStart] = useState(false);

  useEffect(() => {
    setActive(loadActive());
  }, [pathname]);

  const isOn = (tab) => [tab.href, ...(tab.also || [])].some((h) => pathname.startsWith(h));
  const tabLink = (tab) => (
    <Link key={tab.href} href={tab.href} className={isOn(tab) ? 'active' : ''}>
      <tab.Icon size={24} />
      {t(tab.label)}
    </Link>
  );

  return (
    <>
      <nav className="bottom-nav">
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
