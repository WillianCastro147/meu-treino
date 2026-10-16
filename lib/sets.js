// Tipos de série. O campo `type` é opcional: séries antigas (sem type) são normais.
//   normal  — série de trabalho comum
//   warmup  — aquecimento: não conta para volume, recordes, 1RM nem progressão
//   drop    — drop set: carga reduzida logo após a série anterior, sem descanso
//   failure — série levada até a falha (conta como série de trabalho)
export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'];

export const setType = (s) => (SET_TYPES.includes(s?.type) ? s.type : 'normal');
export const isWarmup = (s) => setType(s) === 'warmup';

// Série de trabalho "principal" (base para a progressão): nem aquecimento nem drop
export const isMainWorkSet = (s) => {
  const t = setType(s);
  return t === 'normal' || t === 'failure';
};

// Rótulo de cada série: W (aquecimento), D (drop), F (falha) ou o número da série.
// A numeração conta só as séries normais, como nos apps de treino mais usados.
export function setLabels(sets) {
  let n = 0;
  return (sets || []).map((s) => {
    const t = setType(s);
    if (t === 'warmup') return 'W';
    if (t === 'drop') return 'D';
    if (t === 'failure') return 'F';
    n += 1;
    return String(n);
  });
}

// Escala de esforço: guardamos sempre RPE (6–10). RIR = 10 − RPE.
export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
export const rpeToRir = (rpe) => (rpe === '' || rpe == null ? '' : Math.max(0, 10 - Number(rpe)));
export const rirToRpe = (rir) => (rir === '' || rir == null ? '' : Math.min(10, Math.max(6, 10 - Number(rir))));
