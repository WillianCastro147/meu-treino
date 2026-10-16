'use client';

// Catálogo de exercícios, carregado sob demanda (1,5 MB, fica no cache do navegador):
//   /catalog/exercises.json  catálogo atual (5.632 exercícios do openGym, AGPL, com animação)
//   /catalog/legacy.json     exercícios antigos do Moviq: escondidos da biblioteca, mas ainda
//                            usados para mostrar rotinas e treinos salvos antes da troca
import { createContext, useContext, useEffect, useState } from 'react';

const state = { ready: false, list: [], legacy: [], byId: new Map(), byGif: new Map() };
let pending = null;

const LANG_KEYS = ['en', 'pt', 'es', 'fr'];

function fromCompact(e) {
  const num = e.id.slice(2);
  return {
    id: e.id,
    name: Object.fromEntries(LANG_KEYS.map((l, i) => [l, e.n[i]])),
    bp: e.bp,
    eq: e.eq,
    target: e.t,
    muscle: e.m,
    regions: e.r,
    cat: e.c,
    gif: `/media/still/${num}.webp`,
    clip: `/media/clip/${num}.mp4`,
  };
}

export function loadCatalog() {
  if (!pending) {
    pending = Promise.all([
      fetch('/catalog/exercises.json').then((r) => r.json()),
      fetch('/catalog/legacy.json')
        .then((r) => r.json())
        .catch(() => []),
    ]).then(([current, legacy]) => {
      state.list = current.map(fromCompact);
      state.legacy = legacy.map((e) => ({ ...e, legacy: true }));
      state.legacy.forEach((ex) => {
        state.byId.set(ex.id, ex);
        state.byGif.set(ex.gif, ex);
      });
      state.list.forEach((ex) => {
        state.byId.set(ex.id, ex);
        state.byGif.set(ex.gif, ex);
      });
      state.ready = true;
      return state;
    });
  }
  return pending;
}

// Exercício do catálogo a partir do que foi salvo numa rotina/treino ({ id, gif })
export function findExercise(ex) {
  if (!ex) return null;
  return state.byId.get(ex.id) || state.byGif.get(ex.gif) || null;
}

export const catalogList = () => state.list;

// Detalhes (descrição e passos) por idioma, carregados só na página do exercício
const details = {};
export function loadDetails(lang) {
  if (!details[lang]) details[lang] = fetch(`/catalog/details-${lang}.json`).then((r) => r.json());
  return details[lang];
}

const CatalogContext = createContext({ ready: false, list: [], legacy: [] });

export function CatalogProvider({ children }) {
  const [value, setValue] = useState({ ready: state.ready, list: state.list, legacy: state.legacy });
  useEffect(() => {
    loadCatalog()
      .then((s) => setValue({ ready: true, list: s.list, legacy: s.legacy }))
      .catch(() => {});
  }, []);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

// { ready, list } — os componentes que usam re-renderizam quando o catálogo chega
export const useCatalog = () => useContext(CatalogContext);
