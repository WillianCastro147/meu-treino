'use client';

// Cartões do Início no mesmo formato: ícone, linha pequena, título e ações (fechar/recolher).
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { fmtKg } from '@/lib/stats';
import { IconCheck, IconClose } from '@/components/Icons';

export function CardHead({ icon, tone = 'accent', kicker, title, sub, onClose, extra }) {
  const { t } = useI18n();
  return (
    <div className="hcard-head">
      <span className={`hcard-icon ${tone}`}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker && <p className="today-kicker">{kicker}</p>}
        <p className="hcard-title">{title}</p>
        {sub && <p className="muted" style={{ fontSize: 15, marginTop: 2 }}>{sub}</p>}
      </div>
      {extra}
      {onClose && (
        <button className="icon-btn" onClick={onClose} aria-label={t('close')}>
          <IconClose size={18} />
        </button>
      )}
    </div>
  );
}

const IconRecovery = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4.5" r="2" />
    <path d="M12 7v7M7 10h10M9 21l3-7 3 7" />
  </svg>
);
const IconTarget = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

const IconFood = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" />
    <path d="M17 21V3c-2 1.5-3 4-3 7v3h3" />
  </svg>
);

/** Plano alimentar (só em português): abre /alimentacao, que mostra o plano ou a oferta */
export function NutritionCard() {
  const { lang } = useI18n();
  if (lang !== 'pt') return null;
  return (
    <a className="card" href="/alimentacao" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
      <CardHead icon={<IconFood />} kicker="Alimentação" title="Plano alimentar" sub="Calorias e refeições para o seu objetivo" />
    </a>
  );
}

/** Aviso de recuperação: { group, days, covered } de lib/engage.js recoveryNote */
export function RecoveryCard({ note, onClose }) {
  const { t, tf } = useI18n();
  if (!note) return null;
  return (
    <div className="card">
      <CardHead
        icon={<IconRecovery />}
        kicker={t('recoveryKicker')}
        title={tf('recoveryTitle', { group: t('rgroup_' + note.group), n: note.days })}
        sub={note.covered ? t('recoveryCovered') : t('recoveryHint')}
        onClose={onClose}
      />
    </div>
  );
}

/** Desafios do mês: [{ key, target, value, done }] de lib/engage.js monthlyChallenges */
export function ChallengesCard({ list, locale, onClose }) {
  const { t, tf } = useI18n();
  const [open, setOpen] = useState(true);
  if (!list?.length) return null;
  const done = list.filter((c) => c.done).length;
  const month = new Date().toLocaleDateString(locale, { month: 'long' });
  return (
    <div className="card">
      <CardHead
        icon={<IconTarget />}
        tone="warm"
        kicker={`${month.charAt(0).toUpperCase() + month.slice(1)} · ${tf('challengesDone', { n: done, total: list.length })}`}
        title={t('challengesTitle')}
        onClose={onClose}
        extra={
          <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={open ? '−' : '+'} style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        }
      />
      {open &&
        list.map((c) => (
          <div key={c.key} className="challenge">
            <div className="challenge-top">
              <span>{tf('ch_' + c.key, { n: c.target })}</span>
              <span className={c.done ? 'ch-done' : 'muted'}>
                {c.done && <IconCheck size={14} />} {fmtKg(c.value, locale)} / {fmtKg(c.target, locale)}{c.key === 'tonnes' ? ' t' : ''}
              </span>
            </div>
            <div className="challenge-bar">
              <span className={c.done ? 'done' : ''} style={{ width: `${Math.min(100, (c.value / c.target) * 100)}%` }} />
            </div>
          </div>
        ))}
    </div>
  );
}
