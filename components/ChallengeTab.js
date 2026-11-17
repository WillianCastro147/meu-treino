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

  async function montar() {
    if (challenge && !(await dialog.confirm(t('chConfirmRestart'), { danger: true, confirmLabel: t('create') }))) return;
    setBuilding(true);
    setInfo('');
    const r = await createChallenge(user.id, { level, minutes, notes, lang });
    setBuilding(false);
    if (r.missing) return dialog.alert(t('planSetup'));
    if (r.error) return dialog.alert(t('saveError') + r.error.message);
    if (!r.fromAI) setInfo(t('chReadyUsed'));
    setForm(false);
    onChanged();
  }

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

        <button className="btn coach-btn" style={{ marginTop: 16 }} onClick={montar} disabled={building}>
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
