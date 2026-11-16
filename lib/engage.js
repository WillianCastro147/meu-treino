// O que deixa o app "vivo" no design novo (inspirado no openGym 1.4.5): desafios do mês,
// aviso de recuperação, sequência com medalhas/congelamentos/níveis, treinos restantes na
// semana, seta "melhor/pior que a última vez" e a comparação divertida do total levantado.
// Funções puras, testadas em lib/engage.test.mjs.
import { doneSets, estimate1RM, weekStart, workoutVolume } from './stats.js';
import { muscleOf } from './muscles.js';
import { isoDay } from './plan.js';

const DAY = 864e5;
const WEEK = 7 * DAY;
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ---------- desafios do mês ---------- */

const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const inMonth = (iso, start) => {
  const t = new Date(iso).getTime();
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1).getTime();
  return t >= start.getTime() && t < end;
};

/**
 * Três metas do mês, ajustadas ao seu ritmo: treinos (média dos 2 meses anteriores + 10%),
 * toneladas levantadas (mês anterior + 5%) e dias com pesagem (se usa o peso corporal).
 * [{ key: 'workouts'|'tonnes'|'weighins', target, value, done }]
 */
export function monthlyChallenges(workouts, weighins = null, now = new Date()) {
  const cur = monthStart(now);
  const prev1 = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
  const prev2 = new Date(cur.getFullYear(), cur.getMonth() - 2, 1);
  const ws = workouts || [];
  const count = (start) => ws.filter((w) => inMonth(w.started_at, start)).length;
  const tonnes = (start) => ws.filter((w) => inMonth(w.started_at, start)).reduce((t, w) => t + workoutVolume(w), 0) / 1000;

  const avgPrev = (count(prev1) + count(prev2)) / 2;
  const workoutsTarget = Math.max(4, Math.round(avgPrev * 1.1) || 8);
  const tonTarget = Math.max(5, Math.round(tonnes(prev1) * 1.05) || 10);
  const out = [
    { key: 'workouts', target: workoutsTarget, value: count(cur) },
    { key: 'tonnes', target: tonTarget, value: Math.round(tonnes(cur) * 10) / 10 },
  ];
  if (Array.isArray(weighins)) {
    const days = new Set(weighins.filter((w) => inMonth(w.measured_on + 'T12:00:00', cur)).map((w) => w.measured_on)).size;
    out.push({ key: 'weighins', target: 10, value: days });
  }
  return out.map((c) => ({ ...c, done: c.value >= c.target }));
}

/* ---------- recuperação ---------- */

// Grupos que o aviso acompanha (os de braço viram um só)
const RECOVERY_GROUP = { chest: 'chest', back: 'back', shoulders: 'shoulders', legs: 'legs', glutes: 'legs', biceps: 'arms', triceps: 'arms', abs: 'abs' };

/**
 * O grupo muscular há mais tempo sem treino (7 dias ou mais), entre os que você já treinou.
 * { group, days, covered } — covered: a rotina de hoje trabalha esse grupo. Null se tudo em dia.
 */
export function recoveryNote(workouts, findCatalog, { now = new Date(), todayExercises = [] } = {}) {
  const last = {};
  for (const w of workouts || []) {
    const t = new Date(w.started_at).getTime();
    for (const ex of w.exercises || []) {
      if (!doneSets(ex).length) continue;
      const g = RECOVERY_GROUP[muscleOf(findCatalog(ex))];
      if (g && (last[g] == null || t > last[g])) last[g] = t;
    }
  }
  let worst = null;
  for (const [group, t] of Object.entries(last)) {
    const days = Math.floor((now.getTime() - t) / DAY);
    if (days >= 7 && (!worst || days > worst.days)) worst = { group, days };
  }
  if (!worst) return null;
  const covered = todayExercises.some((ex) => RECOVERY_GROUP[muscleOf(findCatalog(ex))] === worst.group);
  return { ...worst, covered };
}

/* ---------- sequência: medalhas, congelamentos, níveis ---------- */

export const STREAK_BADGES = [4, 12, 26, 52, 104];
export const MAX_FREEZES = 2;
const FREEZE_EVERY = 4; // ganha 1 congelamento a cada 4 semanas seguidas treinadas

/**
 * Semanas seguidas com treino, com congelamentos: uma semana perdida gasta um congelamento
 * em vez de zerar a sequência. A semana atual ainda sem treino não quebra nada.
 * { current, best, freezes, badges: [{ weeks, earned }], nextBadge }
 */
export function streakInfo(workouts, now = new Date()) {
  const weeks = new Set((workouts || []).map((w) => weekStart(w.started_at).getTime()));
  const curWeek = weekStart(now).getTime();
  if (!weeks.size) return { current: 0, best: 0, freezes: 0, badges: STREAK_BADGES.map((w) => ({ weeks: w, earned: false })), nextBadge: STREAK_BADGES[0] };
  let w = Math.min(...weeks);
  let current = 0;
  let best = 0;
  let freezes = 0;
  let run = 0; // semanas treinadas seguidas (para ganhar congelamento)
  for (; w <= curWeek; w = weekStart(new Date(w + WEEK + DAY)).getTime()) {
    if (weeks.has(w)) {
      current += 1;
      run += 1;
      if (run % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
    } else if (w === curWeek) {
      // semana atual ainda em aberto
    } else if (freezes > 0) {
      freezes -= 1;
      run = 0;
    } else {
      current = 0;
      run = 0;
    }
    best = Math.max(best, current);
  }
  const badges = STREAK_BADGES.map((n) => ({ weeks: n, earned: best >= n }));
  return { current, best, freezes, badges, nextBadge: STREAK_BADGES.find((n) => n > current) || null };
}

// Nível: 10 pontos por treino + 20 por semana treinada. Nível n começa em 50·n·(n−1) pontos.
export const levelStart = (n) => 50 * n * (n - 1);
export function levelInfo(workouts) {
  const ws = workouts || [];
  const weeks = new Set(ws.map((w) => weekStart(w.started_at).getTime())).size;
  const points = ws.length * 10 + weeks * 20;
  let level = 1;
  while (points >= levelStart(level + 1)) level += 1;
  const from = levelStart(level);
  const to = levelStart(level + 1);
  return { level, points, toNext: to - points, progress: (points - from) / (to - from) };
}

/* ---------- semana ---------- */

/** Treinos restantes nesta semana pelo plano fixo: { left, planned } ou null (sem plano semanal). */
export function weekLeft(plan, workouts, now = new Date()) {
  if (!plan || plan.mode === 'rotation') return null;
  const planned = Object.keys(plan.week || {}).length;
  if (!planned) return null;
  const start = weekStart(now).getTime();
  const done = new Set(
    (workouts || []).filter((w) => new Date(w.started_at).getTime() >= start).map((w) => isoDay(w.started_at))
  ).size;
  return { left: Math.max(0, planned - done), planned };
}

/* ---------- série contra a última vez ---------- */

/** Esta série contra a mesma série da última vez: 'up' | 'down' | 'same' | null. */
export function setVsLast(set, last) {
  if (!set || !last || set.weight === '' || set.weight == null) return null;
  const a = estimate1RM(set.weight, set.reps);
  const b = estimate1RM(last.weight, last.reps);
  if (a != null && b != null) return a > b + 0.05 ? 'up' : a < b - 0.05 ? 'down' : 'same';
  const wa = num(set.weight) * num(set.reps);
  const wb = num(last.weight) * num(last.reps);
  if (!wa || !wb) return null;
  return wa > wb ? 'up' : wa < wb ? 'down' : 'same';
}

/* ---------- total levantado ---------- */

// Coisas pesadas para comparar (kg). A chave vira texto em lib/i18n.js (fun_<key>).
const HEAVY = [
  ['car', 1500],
  ['elephant', 6000],
  ['bus', 12000],
  ['trex', 8000],
  ['whale', 150000],
  ['jumbo', 400000],
];

/** "Cerca de 2× uma baleia-azul": a coisa mais pesada que cabe ao menos uma vez. */
export function funComparison(totalKg) {
  const kg = num(totalKg);
  const list = [...HEAVY].sort((a, b) => b[1] - a[1]);
  for (const [key, w] of list) if (kg >= w) return { key, times: Math.round((kg / w) * 10) / 10 };
  return null;
}

export const weekdayOf = isoDay;
