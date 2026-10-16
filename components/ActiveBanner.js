'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadActive, activeUrl } from '@/lib/activeWorkout';
import { useI18n } from '@/lib/i18n';
import { IconTimer } from '@/components/Icons';

// Mostra "Treino em andamento · Continuar" quando há um treino não finalizado
export default function ActiveBanner({ userId }) {
  const router = useRouter();
  const { t } = useI18n();
  const [active, setActive] = useState(null);

  useEffect(() => {
    const a = loadActive();
    if (a && a.userId === userId) setActive(a);
  }, [userId]);

  if (!active) return null;

  return (
    <div className="active-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <IconTimer size={20} color="var(--accent)" />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>{t('workoutInProgress')}</p>
          <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {active.routineName}
          </p>
        </div>
      </div>
      <button
        className="btn small"
        onClick={() => router.push(activeUrl(active))}
      >
        {t('continueWorkout')}
      </button>
    </div>
  );
}
