// Regras de progressão por exercício (configuradas na rotina, campo opcional `progression`):
//   { type: 'linear', increment: 2.5 }
//     Se todas as séries de trabalho bateram as repetições planejadas, sobe `increment` kg.
//     Se faltou repetição, repete a carga.
//   { type: 'double', increment: 2.5, repMin: 8, repMax: 12 }
//     Dupla progressão: primeiro sobe repetições dentro da faixa; quando todas as séries
//     chegam ao topo (repMax), sobe a carga e volta para repMin.
// Repetição perdida nunca aumenta a carga.
import { isMainWorkSet } from './sets.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(v * 100) / 100;

export const PROGRESSION_TYPES = ['none', 'linear', 'double'];

// Regra válida com valores padrão, ou null quando não há progressão
export function normalizeRule(rule, plannedReps = 10) {
  if (!rule || !['linear', 'double'].includes(rule.type)) return null;
  const increment = num(rule.increment) > 0 ? num(rule.increment) : 2.5;
  if (rule.type === 'linear') return { type: 'linear', increment };
  let repMin = Math.round(num(rule.repMin)) || Math.max(1, Math.round(num(plannedReps)) || 8);
  let repMax = Math.round(num(rule.repMax)) || repMin + 4;
  if (repMax < repMin) [repMin, repMax] = [repMax, repMin];
  return { type: 'double', increment, repMin, repMax };
}

// Séries de trabalho concluídas de um registro do exercício (sem aquecimento nem drop)
export const workSetsOf = (ex) =>
  (ex?.sets || []).filter((s) => s.done && isMainWorkSet(s)).map((s) => ({ weight: num(s.weight), reps: num(s.reps) }));

// Sugestão para o próximo treino.
//   rule: regra da rotina · plan: { sets, reps } da rotina · last: registro do exercício no último treino
// Retorna { weight, reps, reason, params } ou null (sem regra ou sem histórico com carga).
// `reason` é a chave de texto em lib/i18n.js que explica a sugestão.
export function suggestNext(rule, plan, last) {
  const r = normalizeRule(rule, plan?.reps);
  if (!r) return null;
  const work = workSetsOf(last);
  if (!work.length) return null;

  // Carga de referência: a maior usada nas séries de trabalho
  const weight = Math.max(...work.map((s) => s.weight));
  if (weight <= 0) return null;
  const atWeight = work.filter((s) => s.weight === weight);
  // Só progride se fez todas as séries planejadas na carga de referência
  const plannedSets = Math.max(1, Math.round(num(plan?.sets)) || atWeight.length);
  const complete = atWeight.length >= plannedSets;

  if (r.type === 'linear') {
    const target = Math.max(1, Math.round(num(plan?.reps)) || 1);
    const hit = complete && atWeight.every((s) => s.reps >= target);
    if (hit) return { weight: round2(weight + r.increment), reps: target, reason: 'progLinearUp', params: { inc: r.increment } };
    return { weight, reps: target, reason: 'progLinearHold', params: { reps: target } };
  }

  // Dupla progressão
  const minReps = Math.min(...atWeight.map((s) => s.reps));
  if (complete && minReps >= r.repMax) {
    return { weight: round2(weight + r.increment), reps: r.repMin, reason: 'progDoubleUp', params: { inc: r.increment, max: r.repMax } };
  }
  const reps = Math.min(r.repMax, Math.max(r.repMin, minReps + 1));
  return { weight, reps, reason: 'progDoubleReps', params: { min: r.repMin, max: r.repMax } };
}

// Preenche a sugestão nas séries ainda vazias (não mexe no que o usuário já digitou nem em aquecimento/drop)
export function applySuggestion(sets, suggestion) {
  if (!suggestion) return sets;
  return sets.map((s) =>
    s.done || !isMainWorkSet(s) || s.weight !== ''
      ? s
      : { ...s, weight: suggestion.weight, reps: suggestion.reps }
  );
}
