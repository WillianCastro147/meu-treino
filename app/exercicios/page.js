'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { useI18n, exKey } from '@/lib/i18n';
import { useCatalog } from '@/lib/catalog';
import { fetchAllWorkouts } from '@/lib/data';
import { doneSets, fmtKg } from '@/lib/stats';
import { BODY_PARTS, COMMON_EQUIPMENT, filterExercises, sortByName } from '@/lib/exerciseFilter';
import { IconSearch, IconClose, IconCheck } from '@/components/Icons';

export default function ExerciciosPage() {
  return <AuthGuard>{() => <Biblioteca />}</AuthGuard>;
}

const IconFilter = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);

function Biblioteca() {
  const router = useRouter();
  const { t, tf, lang, locale, bodyPartName, equipName, exMeta } = useI18n();
  const { ready, list, legacy } = useCatalog();
  const [search, setSearch] = useState('');
  const [bp, setBp] = useState('all');
  const [eq, setEq] = useState('all');
  const [onlyDone, setOnlyDone] = useState(false);
  const [limit, setLimit] = useState(60);
  const [history, setHistory] = useState({ counts: new Map(), top: new Map() });
  const [showFilters, setShowFilters] = useState(false);

  // Quantas vezes cada exercício já foi feito e a maior carga usada
  useEffect(() => {
    fetchAllWorkouts()
      .then((ws) => {
        const counts = new Map();
        const top = new Map();
        ws.forEach((w) =>
          (w.exercises || []).forEach((ex) => {
            const sets = doneSets(ex);
            if (!sets.length) return;
            const k = exKey(ex);
            counts.set(k, (counts.get(k) || 0) + 1);
            const best = Math.max(...sets.map((s) => Number(s.weight) || 0));
            if (best > (top.get(k) || 0)) top.set(k, best);
          })
        );
        setHistory({ counts, top });
      })
      .catch(() => {});
  }, [ready]);

  const { counts, top } = history;
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
  const activeFilters = (eq !== 'all' ? 1 : 0) + (onlyDone ? 1 : 0);

  return (
    <div className="page">
      <PageHeader title={t('tabExercises')} sub={tf('exercisesSub', { n: (list.length || 5632).toLocaleString(locale) })} />

      {/* Busca (com contagem e limpar) + botão de filtros */}
      <div className="lib-search">
        <div className="lib-input">
          <IconSearch size={18} />
          <input
            placeholder={t('searchExercise')}
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
            enterKeyHint="search"
          />
          {ready && <span className="lib-count">{filtered.length.toLocaleString(locale)}</span>}
          {search && (
            <button className="lib-clear" onClick={() => reset(setSearch)('')} aria-label={t('clearSearch')}>
              <IconClose size={14} />
            </button>
          )}
        </div>
        <button className={`lib-filter ${activeFilters ? 'on' : ''}`} onClick={() => setShowFilters(true)} aria-label={t('filters')}>
          <IconFilter />
          {activeFilters > 0 && <span className="lib-badge">{activeFilters}</span>}
        </button>
      </div>

      {/* Parte do corpo: uma linha de chips */}
      <div className="chip-row" style={{ padding: '10px 0', border: 'none' }}>
        {['all', ...BODY_PARTS].map((c) => (
          <button key={c} className={`chip ${bp === c ? 'active' : ''}`} onClick={() => reset(setBp)(c)}>
            {c === 'all' ? t('all') : bodyPartName(c)}
          </button>
        ))}
      </div>

      {/* Filtros ativos visíveis (toque para remover) */}
      {activeFilters > 0 && (
        <div className="tags" style={{ marginTop: 0 }}>
          {onlyDone && (
            <button className="tag-chip removable" onClick={() => reset(setOnlyDone)(false)}>
              {t('onlyDone')} <IconClose size={12} />
            </button>
          )}
          {eq !== 'all' && (
            <button className="tag-chip removable" onClick={() => reset(setEq)('all')}>
              {equipName(eq)} <IconClose size={12} />
            </button>
          )}
        </div>
      )}

      {!ready && <p className="muted">{t('loading')}</p>}
      {ready && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted">{t('noExerciseFound')}</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="card" style={{ padding: '4px 14px' }}>
          {filtered.slice(0, limit).map((e) => {
            const n = counts.get(e.id);
            const best = top.get(e.id);
            return (
              <button key={e.id} className="row-link" onClick={() => router.push(`/exercicios/ver?id=${encodeURIComponent(e.id)}`)}>
                <img src={e.gif} alt="" className="ex-thumb" loading="lazy" />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="ex-name ellipsis">{e.name[lang]}</span>
                  <span className="muted">{exMeta(e)}</span>
                </span>
                {n > 0 && (
                  <span className="lib-done">
                    {best > 0 && <span className="best-badge">{fmtKg(best, locale)} kg</span>}
                    <small className="muted">{tf('timesDoneN', { n })}</small>
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

      {showFilters && (
        <div className="modal-overlay" onClick={() => setShowFilters(false)}>
          <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <b style={{ fontSize: 18 }}>{t('filters')}</b>
              <button onClick={() => setShowFilters(false)} style={{ background: 'none', color: 'var(--muted)', fontSize: 24 }} aria-label={t('close')}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <button className={`filter-toggle ${onlyDone ? 'on' : ''}`} onClick={() => reset(setOnlyDone)(!onlyDone)}>
                <span>
                  <b>{t('onlyDone')}</b>
                  <small className="muted">{t('onlyDoneHint')}</small>
                </span>
                <span className="filter-check">{onlyDone && <IconCheck size={16} />}</span>
              </button>
              <p className="section-title" style={{ margin: '16px 0 8px' }}>{t('equipmentLabel')}</p>
              <div className="tags">
                {['all', ...COMMON_EQUIPMENT].map((c) => (
                  <button key={c} className={`chip ${eq === c ? 'active' : ''}`} onClick={() => reset(setEq)(c)}>
                    {c === 'all' ? t('allEquipment') : equipName(c)}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button
                  className="btn secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    reset(setEq)('all');
                    setOnlyDone(false);
                  }}
                >
                  {t('clearFilters')}
                </button>
                <button className="btn" style={{ flex: 1 }} onClick={() => setShowFilters(false)}>
                  {tf('showNResults', { n: filtered.length.toLocaleString(locale) })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
