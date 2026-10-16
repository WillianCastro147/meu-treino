// Busca e filtros da biblioteca de exercícios (função pura, testada em lib/fase2.test.mjs)

export const BODY_PARTS = ['chest', 'back', 'shoulders', 'upper arms', 'lower arms', 'upper legs', 'lower legs', 'waist', 'cardio', 'neck', 'full body'];
export const COMMON_EQUIPMENT = ['body weight', 'dumbbell', 'barbell', 'cable', 'leverage machine', 'kettlebell', 'band', 'smith machine', 'ez barbell'];

export const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// Cópia ordenada pelo nome no idioma (a biblioteca mostra em ordem alfabética)
export function sortByName(list, lang = 'en') {
  const coll = new Intl.Collator(lang, { sensitivity: 'base' });
  return [...(list || [])].sort((a, b) => coll.compare(a.name?.[lang] || '', b.name?.[lang] || ''));
}

// list: exercícios do catálogo · { q, bp, eq, lang, only: Set de ids }
// A busca considera o nome no idioma atual e em inglês; todas as palavras precisam aparecer.
export function filterExercises(list, { q = '', bp = 'all', eq = 'all', lang = 'en', only = null } = {}) {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  return (list || []).filter((e) => {
    if (only && !only.has(e.id)) return false;
    if (bp !== 'all' && e.bp !== bp) return false;
    if (eq !== 'all' && e.eq !== eq) return false;
    if (!words.length) return true;
    const hay = normalize(`${e.name?.[lang] || ''} ${e.name?.en || ''}`);
    return words.every((w) => hay.includes(w));
  });
}
