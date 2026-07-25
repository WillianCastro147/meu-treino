'use client';

import { useMemo, useState } from 'react';
import exercises from '@/data/exercises.json';

const categories = ['Todos', ...new Set(exercises.map((e) => e.category))];

export default function ExercisePicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('Todos');
  const [limit, setLimit] = useState(60);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return exercises.filter((e) => {
      if (cat !== 'Todos' && e.category !== cat) return false;
      if (q && !normalize(e.name + ' ' + (e.muscle || '')).includes(q)) return false;
      return true;
    });
  }, [search, cat]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <b style={{ fontSize: 17 }}>Adicionar exercício</b>
          <button
            onClick={onClose}
            style={{ background: 'none', color: 'var(--muted)', fontSize: 22 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '10px 16px 0' }}>
          <input
            className="input"
            placeholder="🔍 Buscar exercício..."
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
            {filtered.length} exercícios
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
              Mostrar mais
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
