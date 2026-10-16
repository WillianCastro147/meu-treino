// Plano de treino (salvo em profiles.plan, jsonb):
//   { mode: 'week', week: { 1: routineId, 3: routineId, ... } }   1 = segunda ... 7 = domingo
//   { mode: 'rotation', rotation: [routineIdA, routineIdB, ...] } A, B, C, A... o próximo é o
//     seguinte ao último treino feito de uma rotina da rotação, não importa o dia
// Funções puras, testadas em lib/fase2.test.mjs.

export const emptyPlan = () => ({ mode: 'week', week: {}, rotation: [] });

export function normalizePlan(plan) {
  const p = plan && typeof plan === 'object' ? plan : {};
  return {
    mode: p.mode === 'rotation' ? 'rotation' : 'week',
    week: p.week && typeof p.week === 'object' ? p.week : {},
    rotation: Array.isArray(p.rotation) ? p.rotation : [],
  };
}

// 1 = segunda ... 7 = domingo
export const isoDay = (d) => ((new Date(d).getDay() + 6) % 7) + 1;

// Rotina de hoje pelo plano. workouts: mais recentes primeiro, com routine_id quando houver.
// routineIds: ids que ainda existem (rotinas apagadas são ignoradas).
export function todaysRoutine(plan, { date = new Date(), workouts = [], routineIds = null } = {}) {
  const p = normalizePlan(plan);
  const exists = (id) => id && (!routineIds || routineIds.includes(id));

  if (p.mode === 'week') {
    const id = p.week[isoDay(date)];
    return exists(id) ? id : null;
  }

  const rot = p.rotation.filter(exists);
  if (!rot.length) return null;
  const last = workouts.find((w) => rot.includes(w.routine_id));
  if (!last) return rot[0];
  return rot[(rot.indexOf(last.routine_id) + 1) % rot.length];
}

// Remove do plano as rotinas que não existem mais
export function prunePlan(plan, routineIds) {
  const p = normalizePlan(plan);
  return {
    ...p,
    week: Object.fromEntries(Object.entries(p.week).filter(([, id]) => routineIds.includes(id))),
    rotation: p.rotation.filter((id) => routineIds.includes(id)),
  };
}
