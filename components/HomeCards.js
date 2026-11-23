'use client';

// Cartões do Início no mesmo formato: ícone, linha pequena, título e ações (fechar/recolher).
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { fmtKg } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { IconCheck, IconClose, IconChevron } from '@/components/Icons';

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

const IconSpark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </svg>
);

// A conta tem o extra? { liberado, preco } pela mesma rota que a página do extra usa.
// Enquanto carrega (ou se falhar), o cartão aparece como atalho, sem preço.
function useExtra(rota) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const res = await fetch(rota, { headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } });
        if (!res.ok) return;
        const j = await res.json();
        if (vivo) setInfo({ liberado: !!j.liberado, preco: j.preco || j.oferta?.preco || null });
      } catch (e) {}
    })();
    return () => {
      vivo = false;
    };
  }, [rota]);
  return info;
}

// Cartão de um extra: com acesso, atalho (seta); sem acesso, oferta com o valor e "Liberar".
function ExtraCard({ href, icon, kicker, title, sub, ofertaSub, info }) {
  const oferta = info && !info.liberado && info.preco;
  return (
    <a className="card extra-card" href={href}>
      <CardHead
        icon={icon}
        kicker={kicker}
        title={title}
        sub={oferta ? `${ofertaSub} · ${info.preco}` : sub}
        extra={
          oferta ? (
            <span className="pill extra-pill">Liberar</span>
          ) : (
            <span className="extra-chevron">
              <IconChevron size={20} color="var(--muted)" />
            </span>
          )
        }
      />
    </a>
  );
}

/** Coach com IA: abre /coach (gerador de treino com IA, ou a oferta para quem não tem) */
export function CoachCard() {
  const { t, lang } = useI18n();
  const info = useExtra('/api/coach/acesso');
  const pt = lang === 'pt';
  return (
    <ExtraCard
      href="/coach"
      icon={<IconSpark />}
      kicker={pt ? 'Treino com IA' : t('coachTitle')}
      title={pt ? 'Gerador de treino com IA' : t('coachTitle')}
      sub={pt ? 'Crie um treino novo quando quiser' : t('coachSub')}
      ofertaSub="Treinos novos em segundos"
      info={pt ? info : null}
    />
  );
}

/** Plano alimentar (só em português): abre /alimentacao, que mostra o plano ou a oferta */
export function NutritionCard() {
  const { lang } = useI18n();
  const info = useExtra('/api/nutricao');
  if (lang !== 'pt') return null;
  return (
    <ExtraCard
      href="/alimentacao"
      icon={<IconFood />}
      kicker="Alimentação"
      title="Plano alimentar"
      sub="Calorias e refeições para o seu objetivo"
      ofertaSub="Calorias e refeições para você"
      info={info}
    />
  );
}

const IconBook = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
  </svg>
);

/** Guia de Treino Feminino (ebook): só aparece para quem comprou, como atalho para baixar (/guia) */
export function GuideCard() {
  const { lang } = useI18n();
  const info = useExtra('/api/guia?status=1');
  if (lang !== 'pt' || !info?.liberado) return null;
  return (
    <ExtraCard href="/guia" icon={<IconBook />} kicker="Seu ebook" title="Guia de Treino Feminino" sub="Baixe o PDF de 95 páginas" info={info} />
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
