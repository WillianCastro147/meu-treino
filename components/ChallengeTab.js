'use client';

// Aba "Desafio" do Plano: Desafio 21 dias de calistenia (lib/challenge.js).
// Sem desafio: formulário para montar com o Coach (IA). Com desafio: o quadro dos 21 dias
// (components/ChallengeBoard.js) e os botões para recomeçar ou sair.
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useDialog } from '@/components/Dialog';
import ChallengeBoard from '@/components/ChallengeBoard';
import { CHALLENGE_LEVELS, CHALLENGE_MINUTES } from '@/lib/challenge';
import { createChallenge } from '@/lib/challengeCreate';
import { removeChallenge } from '@/lib/data';

export default function ChallengeTab({ user, plan, planMissing, routines, onChanged, onStart }) {
  const { t, lang } = useI18n();
  const dialog = useDialog();
  const challenge = plan.challenge || null;
  const [form, setForm] = useState(false); // mostra o formulário mesmo com desafio (recomeçar)
  const [level, setLevel] = useState('beginner');
  const [minutes, setMinutes] = useState(30);
  const [notes, setNotes] = useState('');
  const [building, setBuilding] = useState(false);
  const [info, setInfo] = useState('');
  // Sem o gerador de treino com IA (extra pago): oferta no lugar do formulário, com o desafio pronto como opção
  const [oferta, setOferta] = useState(null); // { preco }

  async function montar(pronto = false) {
    if (challenge && !pronto && !(await dialog.confirm(t('chConfirmRestart'), { danger: true, confirmLabel: t('create') }))) return;
    setBuilding(true);
    setInfo('');
    const r = await createChallenge(user.id, { level, minutes, notes, lang, pronto, ofertaSeBloqueado: true });
    setBuilding(false);
    if (r.bloqueado) return setOferta({ preco: r.preco });
    if (r.missing) return dialog.alert(t('planSetup'));
    if (r.error) return dialog.alert(t('saveError') + r.error.message);
    if (!r.fromAI && !pronto) setInfo(t('chReadyUsed'));
    setOferta(null);
    setForm(false);
    onChanged();
  }

  // Pagamento do gerador (mesmo da página do Coach): volta pelo /bem-vindo e libera pelo e-mail da conta
  const comprarGerador = () => {
    const f = document.createElement('form');
    f.method = 'POST';
    f.action = '/api/stripe/checkout';
    for (const [k, v] of Object.entries({ plano: 'gerador_ia', email: user.email || '' })) {
      const i = document.createElement('input');
      i.type = 'hidden';
      i.name = k;
      i.value = v;
      f.append(i);
    }
    document.body.append(f);
    f.submit();
  };

  async function sair() {
    if (!(await dialog.confirm(t('chConfirmLeave'), { danger: true, confirmLabel: t('chLeave') }))) return;
    const r = await removeChallenge(user.id);
    if (r.error) return dialog.alert(t('saveError') + r.error.message);
    setInfo('');
    onChanged();
  }

  if (planMissing) {
    return (
      <div className="card">
        <p className="card-title">{t('chTitle')}</p>
        <p className="muted">{t('planSetup')}</p>
      </div>
    );
  }

  // ---------- Sem o gerador: oferta + desafio pronto ----------
  if (oferta && (!challenge || form)) {
    return (
      <div className="card">
        <p className="card-title">{t('chLockedTitle')}</p>
        <p className="muted" style={{ lineHeight: 1.45 }}>{t('chLockedText')}</p>
        {oferta.preco && (
          <p style={{ margin: '14px 0 12px' }}>
            <b style={{ fontSize: 24 }}>{oferta.preco}</b> <span className="muted">{t('chLockedOnce')}</span>
          </p>
        )}
        {oferta.preco && (
          <button className="btn" style={{ width: '100%' }} onClick={comprarGerador} disabled={building}>
            {t('chUnlock')}
          </button>
        )}
        <button className="btn secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => montar(true)} disabled={building}>
          {building ? t('chBuilding') : t('chUseReady')}
        </button>
        <button className="link-btn" style={{ display: 'block', margin: '12px auto 0' }} onClick={() => setOferta(null)} disabled={building}>
          {t('back')}
        </button>
      </div>
    );
  }

  // ---------- Montar o desafio ----------
  if (!challenge || form) {
    return (
      <div className="card">
        <p className="card-title">{t('chTitle')}</p>
        <p className="muted" style={{ marginBottom: 6 }}>{t('chIntro')}</p>

        <label className="label">{t('coachLevel')}</label>
        <div className="seg">
          {CHALLENGE_LEVELS.map((l) => (
            <button key={l} className={level === l ? 'active' : ''} onClick={() => setLevel(l)}>
              {t('level_' + l)}
            </button>
          ))}
        </div>

        <label className="label">{t('coachMinutes')}</label>
        <div className="seg">
          {CHALLENGE_MINUTES.map((m) => (
            <button key={m} className={minutes === m ? 'active' : ''} onClick={() => setMinutes(m)}>
              {m} min
            </button>
          ))}
        </div>

        <label className="label">{t('coachNotes')}</label>
        <textarea className="input" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('coachNotesPh')} />

        <button className="btn coach-btn" style={{ marginTop: 16 }} onClick={() => montar()} disabled={building}>
          {building ? t('chBuilding') : t('chBuild')}
        </button>
        {challenge && (
          <button className="link-btn" style={{ display: 'block', margin: '12px auto 0' }} onClick={() => setForm(false)} disabled={building}>
            {t('back')}
          </button>
        )}
      </div>
    );
  }

  // ---------- Desafio em andamento ----------
  return (
    <>
      <ChallengeBoard challenge={challenge} routines={routines} onStart={onStart}>
        {challenge.summary && <p className="muted" style={{ marginBottom: 10 }}>{challenge.summary}</p>}
        {info && <p className="muted" style={{ marginBottom: 10, fontSize: 14 }}>{info}</p>}
      </ChallengeBoard>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn secondary small" style={{ flex: 1 }} onClick={() => setForm(true)}>
          {t('chRestart')}
        </button>
        <button className="btn danger small" style={{ flex: 1 }} onClick={sair}>
          {t('chLeave')}
        </button>
      </div>
    </>
  );
}
