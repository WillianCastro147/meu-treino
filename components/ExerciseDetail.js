'use client';

import { useI18n } from '@/lib/i18n';

// Detalhe do exercício: GIF grande + categoria e músculo
export default function ExerciseDetail({ exercise, onClose, onSelect }) {
  const { t, exName, exMeta } = useI18n();
  if (!exercise) return null;

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="detail" onClick={(e) => e.stopPropagation()}>
        <div className="detail-gif">
          <img src={exercise.gif} alt={exName(exercise)} />
        </div>
        <div style={{ padding: 16 }}>
          <b style={{ fontSize: 19, display: 'block' }}>{exName(exercise)}</b>
          <p className="muted" style={{ marginTop: 4 }}>{exMeta(exercise)}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn secondary" onClick={onClose}>
              {t('close')}
            </button>
            {onSelect && (
              <button className="btn" onClick={() => onSelect(exercise)}>
                {t('addExercise')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
