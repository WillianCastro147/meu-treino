'use client';

import { useMemo, useState } from 'react';
import exercises from '@/data/exercises.json';
import { useI18n } from '@/lib/i18n';
import { IconSearch } from '@/components/Icons';

const categoryKeys = ['all', ...new Set(exercises.map((e) => e.cat))];

export default function ExercisePicker({ onSelect, onClose }) {
  const { t, lang, catName, muscleName } = useI18n();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [limit, setLimit] = useState(60);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return exercises.filter((e) => {
      if (cat !== 'all' && e.cat !== cat) return false;
      if (q && !normalize(e.name[lang] + ' ' + muscleName(e.muscle)).includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, cat, lang]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <b style={{ fontSize: 18 }}>{t('addExercise')}</b>
          <button
            onClick={onClose}
            style={{ background: 'none', color: 'var(--muted)', fontSize: 24 }}
          >
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
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(60);
            }}
          />
        </div>

        <div className="chip-row">
          {categoryKeys.map((c) => (
            <button
              key={c}
              className={`chip ${cat === c ? 'active' : ''}`}
              onClick={() => {
                setCat(c);
                setLimit(60);
              }}
            >
              {c === 'all' ? t('all') : catName(c)}
            </button>
          ))}
        </div>

        <div className="modal-body">
          <p className="muted" style={{ marginBottom: 6 }}>
            {filtered.length} {t('exercisesCount')}
          </p>
          {filtered.slice(0, limit).map((e) => (
            <div
              key={e.id}
              className="ex-row"
              style={{ cursor: 'pointer' }}
              onClick={() => onSelect(e)}
            >
              <img src={e.gif} alt="" className="ex-thumb" loading="lazy" />
              <div>
                <p className="ex-name">{e.name[lang]}</p>
                <p className="muted">
                  {catName(e.cat)}
                  {e.muscle ? ` · ${muscleName(e.muscle)}` : ''}
                </p>
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
    </div>
  );
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
