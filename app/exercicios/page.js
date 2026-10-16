'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import exercises from '@/data/exercises.json';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import { useI18n, exKey } from '@/lib/i18n';
import { fetchAllWorkouts } from '@/lib/data';
import { doneSets } from '@/lib/stats';
import { IconSearch } from '@/components/Icons';

const categoryKeys = ['all', 'done', ...new Set(exercises.map((e) => e.cat))];

export default function ExerciciosPage() {
  return <AuthGuard>{() => <Biblioteca />}</AuthGuard>;
}

function Biblioteca() {
  const router = useRouter();
  const { t, lang, catName, muscleName } = useI18n();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [limit, setLimit] = useState(60);
  const [counts, setCounts] = useState(new Map());

  // Quantas vezes cada exercício já foi feito
  useEffect(() => {
    fetchAllWorkouts()
      .then((ws) => {
        const m = new Map();
        ws.forEach((w) =>
          (w.exercises || []).forEach((ex) => {
            if (doneSets(ex).length) m.set(exKey(ex), (m.get(exKey(ex)) || 0) + 1);
          })
        );
        setCounts(m);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(search);
    const list = exercises.filter((e) => {
      if (cat === 'done' && !counts.has(e.id)) return false;
      if (cat !== 'all' && cat !== 'done' && e.cat !== cat) return false;
      if (q && !normalize(e.name[lang] + ' ' + muscleName(e.muscle)).includes(q)) return false;
      return true;
    });
    // Os mais feitos primeiro no filtro "Que já fiz"
    if (cat === 'done') list.sort((a, b) => counts.get(b.id) - counts.get(a.id));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, cat, lang, counts]);

  return (
    <div className="page">
      <h1 className="page-title">{t('tabExercises')}</h1>

      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }}>
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

      <div className="chip-row" style={{ padding: '10px 0', border: 'none' }}>
        {categoryKeys.map((c) => (
          <button
            key={c}
            className={`chip ${cat === c ? 'active' : ''}`}
            onClick={() => {
              setCat(c);
              setLimit(60);
            }}
          >
            {c === 'all' ? t('all') : c === 'done' ? t('onlyDone') : catName(c)}
          </button>
        ))}
      </div>

      <p className="muted" style={{ marginBottom: 6 }}>
        {filtered.length} {t('exercisesCount')}
      </p>

      <div className="card" style={{ padding: '4px 14px' }}>
        {filtered.slice(0, limit).map((e) => {
          const n = counts.get(e.id);
          return (
            <button key={e.id} className="row-link" onClick={() => router.push(`/exercicios/ver?id=${encodeURIComponent(e.id)}`)}>
              <img src={e.gif} alt="" className="ex-thumb" loading="lazy" />
              <span style={{ minWidth: 0 }}>
                <span className="ex-name ellipsis">{e.name[lang]}</span>
                <span className="muted">
                  {catName(e.cat)}
                  {e.muscle ? ` · ${muscleName(e.muscle)}` : ''}
                </span>
              </span>
              {n > 0 && (
                <span className="row-right muted">
                  <b style={{ color: 'var(--text)' }}>{n}</b> {t('timesDone')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length > limit && (
        <button className="btn secondary" onClick={() => setLimit(limit + 60)}>
          {t('showMore')}
        </button>
      )}

      <BottomNav />
    </div>
  );
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
