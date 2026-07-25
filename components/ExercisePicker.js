'use client';

import { useMemo, useState } from 'react';
import exercises from '@/data/exercises.json';
import { IconSearch } from '@/components/Icons';

const categories = ['Tous', ...new Set(exercises.map((e) => e.category))];

export default function ExercisePicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('Tous');
  const [limit, setLimit] = useState(60);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return exercises.filter((e) => {
      if (cat !== 'Tous' && e.category !== cat) return false;
      if (q && !normalize(e.name + ' ' + (e.muscle || '')).includes(q)) return false;
      return true;
    });
  }, [search, cat]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <b style={{ fontSize: 18 }}>Ajouter un exercice</b>
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
            placeholder="Rechercher un exercice..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(60);
            }}
          />
        </div>

        <div className="chip-row">
          {categories.map((c) => (
            <button
              key={c}
              className={`chip ${cat === c ? 'active' : ''}`}
              onClick={() => {
                setCat(c);
                setLimit(60);
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="modal-body">
          <p className="muted" style={{ marginBottom: 6 }}>
            {filtered.length} exercices
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
                <p className="ex-name">{e.name}</p>
                <p className="muted">
                  {e.category}
                  {e.muscle ? ` · ${e.muscle}` : ''}
                </p>
              </div>
            </div>
          ))}
          {filtered.length > limit && (
            <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => setLimit(limit + 60)}>
              Afficher plus
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
