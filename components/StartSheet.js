'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { IconPlay, IconPlus } from '@/components/Icons';

// Folha do botão central "Iniciar": treino livre ou uma das rotinas
export default function StartSheet({ onClose }) {
  const router = useRouter();
  const { t, exName } = useI18n();
  const [routines, setRoutines] = useState(null);

  useEffect(() => {
    supabase
      .from('routines')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRoutines(data || []));
  }, []);

  const go = (url) => {
    onClose();
    router.push(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <b style={{ fontSize: 18 }}>{t('startWorkout')}</b>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)', fontSize: 24 }} aria-label={t('close')}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <button className="start-option" onClick={() => go('/treino/executar?livre=1')}>
            <span className="start-option-icon">
              <IconPlus size={20} />
            </span>
            <span style={{ textAlign: 'left' }}>
              <b style={{ display: 'block' }}>{t('emptyWorkout')}</b>
              <span className="muted">{t('emptyWorkoutHint')}</span>
            </span>
          </button>

          <p className="section-title">{t('chooseRoutine')}</p>
          {routines === null && <p className="muted">{t('loading')}</p>}
          {routines && routines.length === 0 && <p className="muted">{t('noRoutines')}</p>}
          {routines &&
            routines.map((r) => (
              <button key={r.id} className="start-option" onClick={() => go(`/treino/executar?id=${r.id}`)}>
                <span className="start-option-icon accent">
                  <IconPlay size={18} color="#fff" />
                </span>
                <span style={{ textAlign: 'left', minWidth: 0 }}>
                  <b style={{ display: 'block' }}>{r.name}</b>
                  <span className="muted ellipsis">{(r.exercises || []).map((e) => exName(e)).join(' · ')}</span>
                </span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
