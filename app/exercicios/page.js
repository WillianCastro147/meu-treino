'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { useI18n, exKey } from '@/lib/i18n';
import { useCatalog } from '@/lib/catalog';
import { fetchAllWorkouts } from '@/lib/data';
import { doneSets } from '@/lib/stats';
import { BODY_PARTS, COMMON_EQUIPMENT, filterExercises, sortByName } from '@/lib/exerciseFilter';
import { IconSearch } from '@/components/Icons';

export default function ExerciciosPage() {
  return <AuthGuard>{() => <Biblioteca />}</AuthGuard>;
}

function Biblioteca() {
  const router = useRouter();
  const { t, tf, lang, locale, bodyPartName, equipName, exMeta } = useI18n();
  const { ready, list, legacy } = useCatalog();
  const [search, setSearch] = useState('');
  const [bp, setBp] = useState('all');
  const [eq, setEq] = useState('all');
  const [onlyDone, setOnlyDone] = useState(false);
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
  }, [ready]);

  const sorted = useMemo(() => sortByName(list, lang), [list, lang]);
  const filtered = useMemo(() => {
    // Com "Que já fiz", entram também os exercícios antigos do Moviq que você fez
    const source = onlyDone ? [...list, ...legacy.filter((e) => counts.has(e.id))] : sorted;
    const out = filterExercises(source, { q: search, bp, eq, lang, only: onlyDone ? new Set(counts.keys()) : null });
    if (onlyDone) out.sort((a, b) => counts.get(b.id) - counts.get(a.id));
    return out;
  }, [list, legacy, sorted, search, bp, eq, lang, onlyDone, counts]);

  const reset = (fn) => (v) => {
    fn(v);
    setLimit(60);
  };

  return (
    <div className="page">
      <PageHeader title={t('tabExercises')} sub={tf('exercisesSub', { n: (list.length || 5632).toLocaleString(locale) })} />

      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }}>
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

      <div className="chip-row" style={{ padding: '10px 0 4px', border: 'none' }}>
        <button className={`chip ${onlyDone ? 'active' : ''}`} onClick={() => reset(setOnlyDone)(!onlyDone)}>
          {t('onlyDone')}
        </button>
        {['all', ...BODY_PARTS].map((c) => (
          <button key={c} className={`chip ${bp === c ? 'active' : ''}`} onClick={() => reset(setBp)(c)}>
            {c === 'all' ? t('all') : bodyPartName(c)}
          </button>
        ))}
      </div>
      <div className="chip-row" style={{ padding: '4px 0 10px', border: 'none' }}>
        {['all', ...COMMON_EQUIPMENT].map((c) => (
          <button key={c} className={`chip ${eq === c ? 'active' : ''}`} onClick={() => reset(setEq)(c)}>
            {c === 'all' ? t('allEquipment') : equipName(c)}
          </button>
        ))}
      </div>

      {!ready && <p className="muted">{t('loading')}</p>}
      {ready && (
        <p className="muted" style={{ marginBottom: 6 }}>
          {filtered.length} {t('exercisesCount')}
        </p>
      )}

      {filtered.length > 0 && (
        <div className="card" style={{ padding: '4px 14px' }}>
          {filtered.slice(0, limit).map((e) => {
            const n = counts.get(e.id);
            return (
              <button key={e.id} className="row-link" onClick={() => router.push(`/exercicios/ver?id=${encodeURIComponent(e.id)}`)}>
                <img src={e.gif} alt="" className="ex-thumb" loading="lazy" />
                <span style={{ minWidth: 0 }}>
                  <span className="ex-name ellipsis">{e.name[lang]}</span>
                  <span className="muted">{exMeta(e)}</span>
                </span>
                {n > 0 && (
                  <span className="row-right muted" title={`${n} ${t('timesDone')}`}>
                    <b style={{ color: 'var(--text)' }}>{n}×</b>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length > limit && (
        <button className="btn secondary" onClick={() => setLimit(limit + 60)}>
          {t('showMore')}
        </button>
      )}

      <BottomNav />
    </div>
  );
}
