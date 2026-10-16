'use client';

import { useMemo, useState } from 'react';
import { useCatalog } from '@/lib/catalog';
import { useI18n } from '@/lib/i18n';
import { BODY_PARTS, COMMON_EQUIPMENT, filterExercises, sortByName } from '@/lib/exerciseFilter';
import { IconSearch } from '@/components/Icons';
import ExerciseDetail from '@/components/ExerciseDetail';

// Escolher um exercício do catálogo: busca, parte do corpo e equipamento
export default function ExercisePicker({ onSelect, onClose }) {
  const { t, lang, bodyPartName, equipName, exMeta } = useI18n();
  const { ready, list } = useCatalog();
  const [search, setSearch] = useState('');
  const [bp, setBp] = useState('all');
  const [eq, setEq] = useState('all');
  const [limit, setLimit] = useState(60);
  const [detail, setDetail] = useState(null);

  const sorted = useMemo(() => sortByName(list, lang), [list, lang]);
  const filtered = useMemo(() => filterExercises(sorted, { q: search, bp, eq, lang }), [sorted, search, bp, eq, lang]);
  const reset = (fn) => (v) => {
    fn(v);
    setLimit(60);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <b style={{ fontSize: 18 }}>{t('addExercise')}</b>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)', fontSize: 24 }} aria-label={t('close')}>
            ✕
          </button>
        </div>

        <div style={{ padding: '10px 16px 0', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 30, top: 24, color: 'var(--muted)' }}>
            <IconSearch size={18} />
          </span>
          <input
            className="input"
            style={{ paddingLeft: 42 }}
            placeholder={t('searchExercise')}
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
          />
        </div>

        <div className="chip-row">
          {['all', ...BODY_PARTS].map((c) => (
            <button key={c} className={`chip ${bp === c ? 'active' : ''}`} onClick={() => reset(setBp)(c)}>
              {c === 'all' ? t('all') : bodyPartName(c)}
            </button>
          ))}
        </div>
        <div className="chip-row">
          {['all', ...COMMON_EQUIPMENT].map((c) => (
            <button key={c} className={`chip ${eq === c ? 'active' : ''}`} onClick={() => reset(setEq)(c)}>
              {c === 'all' ? t('allEquipment') : equipName(c)}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {!ready && <p className="muted">{t('loading')}</p>}
          {ready && (
            <p className="muted" style={{ marginBottom: 6 }}>
              {filtered.length} {t('exercisesCount')}
            </p>
          )}
          {filtered.slice(0, limit).map((e) => (
            <div key={e.id} className="ex-row" style={{ cursor: 'pointer' }} onClick={() => onSelect(e)}>
              <button
                className="thumb-btn"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setDetail(e);
                }}
                aria-label={e.name[lang]}
              >
                <img src={e.gif} alt="" className="ex-thumb" loading="lazy" />
              </button>
              <div style={{ minWidth: 0 }}>
                <p className="ex-name">{e.name[lang]}</p>
                <p className="muted">{exMeta(e)}</p>
              </div>
            </div>
          ))}
          {filtered.length > limit && (
            <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => setLimit(limit + 60)}>
              {t('showMore')}
            </button>
          )}
        </div>
      </div>
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} onSelect={(ex) => onSelect(ex)} />}
    </div>
  );
}
