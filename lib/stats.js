// Cálculos de progresso (1RM estimado, recordes, volume, frequência).
// Funções puras, sem React nem Supabase: recebem os treinos como vêm do banco
// ({ started_at, duration_min, exercises: [{ id, gif, sets: [{ weight, reps, done }] }] }).
// Testes em lib/stats.test.mjs (rode com: npm test).

// Acima disso a fórmula diz mais sobre resistência do que sobre força máxima
export const REP_CAP = 12;

const defaultKey = (e) => e?.id || e?.gif;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const doneSets = (ex) => (ex?.sets || []).filter((s) => s.done);

// 1RM estimado de uma série (Epley). 1 repetição é a própria medida.
export function estimate1RM(weight, reps) {
  const w = num(weight);
  const r = Math.round(num(reps));
  if (w <= 0 || r < 1 || r > REP_CAP) return null;
  const est = r === 1 ? w : w * (1 + r / 30);
  return Math.round(est * 10) / 10;
}

// Melhor série de um exercício num treino: { est, weight, reps } ou null
export function bestSet(ex) {
  let best = null;
  for (const s of doneSets(ex)) {
    const est = estimate1RM(s.weight, s.reps);
    if (est !== null && (!best || est > best.est)) best = { est, weight: num(s.weight), reps: Math.round(num(s.reps)) };
  }
  return best;
}

export function exerciseVolume(ex) {
  return doneSets(ex).reduce((t, s) => t + num(s.weight) * num(s.reps), 0);
}

export function workoutVolume(w) {
  return (w?.exercises || []).reduce((t, ex) => t + exerciseVolume(ex), 0);
}

export function workoutSets(w) {
  return (w?.exercises || []).reduce((t, ex) => t + doneSets(ex).length, 0);
}

const byDateAsc = (a, b) => new Date(a.started_at) - new Date(b.started_at);

// Histórico de um exercício, do mais antigo ao mais recente
export function exerciseHistory(workouts, key, keyOf = defaultKey) {
  const out = [];
  [...(workouts || [])].sort(byDateAsc).forEach((w) => {
    (w.exercises || []).forEach((ex) => {
      if (keyOf(ex) !== key || !doneSets(ex).length) return;
      const sets = doneSets(ex);
      out.push({
        workoutId: w.id,
        date: w.started_at,
        sets: sets.map((s) => ({ weight: num(s.weight), reps: num(s.reps) })),
        best: bestSet(ex),
        volume: exerciseVolume(ex),
        topWeight: Math.max(...sets.map((s) => num(s.weight))),
      });
    });
  });
  return out;
}

// Resumo de um exercício: recordes de 1RM, carga, volume e repetições
export function exerciseSummary(history) {
  const s = { sessions: history.length, best1RM: null, topWeight: 0, bestVolume: 0, maxReps: 0, lastDate: null };
  history.forEach((h) => {
    if (h.best && (!s.best1RM || h.best.est > s.best1RM.est)) s.best1RM = { ...h.best, date: h.date };
    if (h.topWeight > s.topWeight) s.topWeight = h.topWeight;
    if (h.volume > s.bestVolume) s.bestVolume = h.volume;
    h.sets.forEach((x) => {
      if (x.reps > s.maxReps) s.maxReps = x.reps;
    });
    s.lastDate = h.date;
  });
  return s;
}

// Melhor 1RM de todos os exercícios: Map(key -> { est, weight, reps, date, ex })
export function bestByExercise(workouts, keyOf = defaultKey) {
  const map = new Map();
  (workouts || []).forEach((w) =>
    (w.exercises || []).forEach((ex) => {
      const b = bestSet(ex);
      const k = keyOf(ex);
      if (!b || !k) return;
      const cur = map.get(k);
      if (!cur || b.est > cur.est) map.set(k, { ...b, date: w.started_at, ex });
    })
  );
  return map;
}

// Recordes batidos num treino novo, comparando com o histórico anterior a ele.
// Retorna [{ key, ex, est, weight, reps, prev }]
export function findRecords(workout, history, keyOf = defaultKey) {
  const before = bestByExercise(history, keyOf);
  const out = [];
  (workout?.exercises || []).forEach((ex) => {
    const b = bestSet(ex);
    const k = keyOf(ex);
    if (!b || !k) return;
    const prev = before.get(k);
    if (!prev || b.est > prev.est) out.push({ key: k, ex, ...b, prev: prev ? prev.est : 0 });
  });
  return out;
}

// Uma série é recorde se o 1RM dela supera o melhor anterior E as séries
// anteriores do mesmo exercício neste treino
export function isSetRecord(set, previousBest, earlierSets = []) {
  if (!set?.done) return false;
  const est = estimate1RM(set.weight, set.reps);
  if (est === null) return false;
  if (previousBest != null && est <= previousBest) return false;
  return !earlierSets.some((s) => s.done && (estimate1RM(s.weight, s.reps) ?? 0) >= est);
}

// ---------- Datas (sempre no fuso do aparelho) ----------

export function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

// Segunda-feira da semana de `d`, às 00:00
export function weekStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// Volume e número de treinos por semana, das últimas `weeks` semanas (mais antiga primeiro)
export function weeklySummary(workouts, weeks = 12, now = new Date()) {
  const start = weekStart(now);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i * 7);
    buckets.push({ start: d, workouts: 0, volume: 0, sets: 0, minutes: 0 });
  }
  const first = buckets[0].start.getTime();
  (workouts || []).forEach((w) => {
    const t = new Date(w.started_at).getTime();
    if (t < first) return;
    const idx = Math.floor((weekStart(w.started_at).getTime() - first) / (7 * 864e5) + 0.5);
    const b = buckets[idx];
    if (!b) return;
    b.workouts += 1;
    b.volume += workoutVolume(w);
    b.sets += workoutSets(w);
    b.minutes += num(w.duration_min);
  });
  return buckets;
}

// Contagem de treinos por dia: Map('2026-10-16' -> n)
export function activityByDay(workouts) {
  const map = new Map();
  (workouts || []).forEach((w) => {
    const k = dayKey(w.started_at);
    map.set(k, (map.get(k) || 0) + 1);
  });
  return map;
}

// Semanas seguidas (até a atual) com pelo menos um treino.
// A semana atual sem treino ainda não quebra a sequência.
export function weekStreak(workouts, now = new Date()) {
  const weeks = new Set((workouts || []).map((w) => weekStart(w.started_at).getTime()));
  const cur = weekStart(now);
  let streak = 0;
  if (!weeks.has(cur.getTime())) cur.setDate(cur.getDate() - 7);
  while (weeks.has(cur.getTime())) {
    streak += 1;
    cur.setDate(cur.getDate() - 7);
  }
  return streak;
}

// Totais gerais
export function totals(workouts) {
  return (workouts || []).reduce(
    (t, w) => ({
      workouts: t.workouts + 1,
      minutes: t.minutes + num(w.duration_min),
      volume: t.volume + workoutVolume(w),
      sets: t.sets + workoutSets(w),
    }),
    { workouts: 0, minutes: 0, volume: 0, sets: 0 }
  );
}

// Formata kg sem casas inúteis: 1250 -> "1.250", 62.5 -> "62,5" (conforme o idioma)
export function fmtKg(v, locale) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.round(num(v) * 10) / 10);
}

// 45 -> "45min" · 90 -> "1h30" · 600 -> "10h"
export function fmtDuration(min) {
  min = Math.round(num(min));
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h >= 10 || m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
