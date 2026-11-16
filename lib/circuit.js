// Circuitos, AMRAP, EMOM e intervalos (Tabata): uma rotina que roda no relógio em vez de série
// por série. Motor adaptado do openGym (frontend/src/lib/circuit.js, AGPL-3.0), puro e testado
// em lib/circuit.test.mjs; a tela /treino/circuito só mostra o que ele decide.
//
// Onde fica: cada exercício da rotina leva o mesmo `circuit` ({ mode, ... }) no JSON da rotina,
// então não precisa de coluna nova no banco. O resultado vai no 1º exercício do treino salvo
// (`circuitResult`).
//
// Os modos:
//   circuit    rodadas pelas estações; estação de reps termina no "Feito", estação por tempo
//              sozinha; descanso opcional entre estações (`gap`) e entre rodadas (`roundRest`).
//   amrap      as estações de novo e de novo até acabar o tempo (`cap`); placar = rodadas
//              completas + reps da rodada em que parou.
//   emom       um intervalo a cada `every` segundos, `count` vezes; o intervalo n é a estação
//              n mod (nº de estações). O que sobra do minuto depois do "Feito" é descanso.
//              Sem atraso acumulado: o intervalo n começa em início + n × every.
//   intervals  trabalho / descanso × rodadas pelas estações (Tabata = 20/10 × 8).
//
// Cada etapa (preparar, trabalho, descanso) tem duração fixa ou é aberta (até o "Feito").
// Uma etapa que acaba pelo relógio passa a vez no seu horário exato, não no tique que percebeu:
// com o celular bloqueado por 3 minutos, ao voltar o treino está exatamente onde o relógio está.

export const CIRCUIT_MODES = ['circuit', 'amrap', 'emom', 'intervals'];
export const PREP_SEC = 10;

const LIMITS = {
  rounds: [1, 50, 3],
  cap: [60, 3600, 600],
  every: [10, 600, 60],
  count: [1, 99, 10],
  work: [5, 3600, 20],
  rest: [0, 600, 10],
  gap: [0, 300, 0],
  roundRest: [0, 600, 60],
};
const clampInt = (v, [lo, hi, def]) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
};

/** Config limpa, ou null para o que não é circuito. Só os campos que o modo usa. */
export function cleanCircuit(c) {
  if (!c || typeof c !== 'object' || !CIRCUIT_MODES.includes(c.mode)) return null;
  const mode = c.mode;
  if (mode === 'circuit')
    return { mode, rounds: clampInt(c.rounds, LIMITS.rounds), gap: clampInt(c.gap, LIMITS.gap), roundRest: clampInt(c.roundRest, LIMITS.roundRest) };
  if (mode === 'amrap') return { mode, cap: clampInt(c.cap, LIMITS.cap) };
  if (mode === 'emom') return { mode, every: clampInt(c.every, LIMITS.every), count: clampInt(c.count, LIMITS.count) };
  return {
    mode,
    work: clampInt(c.work, LIMITS.work),
    rest: clampInt(c.rest, LIMITS.rest),
    rounds: clampInt(c.rounds, [1, 50, 8]),
    roundRest: clampInt(c.roundRest ?? 0, LIMITS.roundRest),
  };
}

/** Valores iniciais quando o tipo é escolhido no editor ('tabata' = intervalos 20/10 × 8). */
export function defaultCircuit(mode) {
  if (mode === 'tabata') return cleanCircuit({ mode: 'intervals', work: 20, rest: 10, rounds: 8, roundRest: 0 });
  if (mode === 'circuit') return cleanCircuit({ mode, rounds: 3, gap: 15, roundRest: 60 });
  if (mode === 'intervals') return cleanCircuit({ mode, work: 40, rest: 20, rounds: 3, roundRest: 0 });
  return cleanCircuit({ mode });
}

/* ---------- na rotina ---------- */

/** O circuito de uma rotina (lista de exercícios), ou null se ela é normal. */
export function circuitOfRoutine(exercises) {
  for (const e of exercises || []) {
    const c = cleanCircuit(e?.circuit);
    if (c) return c;
  }
  return null;
}

/** Grava `cfg` em todos os exercícios da rotina (null volta a rotina para normal). Retorna cópia. */
export function setRoutineCircuit(exercises, cfg) {
  const clean = cleanCircuit(cfg);
  return (exercises || []).map((e) => {
    const { circuit: _c, ...rest } = e || {};
    return clean ? { ...rest, circuit: { ...clean }, linkNext: false } : rest;
  });
}

/** Para onde vai o "Iniciar" de uma rotina: o player do circuito ou o treino normal. */
export const startUrl = (routine) =>
  circuitOfRoutine(routine?.exercises) ? `/treino/circuito?id=${routine.id}` : `/treino/executar?id=${routine.id}`;

/* ---------- estações e etapas ---------- */

/**
 * As estações a partir dos exercícios da rotina: o que cada uma pede por rodada.
 * `weights`: exKey -> carga da última vez (opcional). `keyOf` dá a chave do exercício.
 */
export function stationsFrom(exercises, { weights = {}, keyOf = (e) => e.id } = {}) {
  return (exercises || []).map((e, idx) => {
    const sec = Math.max(0, Math.round(Number(e.sec) || 0));
    return {
      idx,
      id: e.id,
      mode: sec > 0 ? 'time' : 'reps',
      reps: Math.max(0, Math.round(Number(e.reps) || 0)),
      w: Number(weights[keyOf(e)]) || 0,
      sec,
    };
  });
}

/** Quantas etapas a execução tem (Infinity no AMRAP, que acaba pelo tempo). */
export function stepCount(cfg, n) {
  if (!cfg || !n) return 0;
  if (cfg.mode === 'amrap') return Infinity;
  return 1 + bodyCount(cfg, n);
}
function bodyCount(cfg, n) {
  if (cfg.mode === 'emom') return cfg.count;
  if (cfg.mode === 'circuit')
    return cfg.rounds * n + (cfg.gap > 0 ? cfg.rounds * (n - 1) : 0) + Math.max(0, cfg.rounds - 1) * (cfg.roundRest > 0 ? 1 : 0);
  // intervalos: trabalho e descanso depois de cada trabalho, menos o último
  return cfg.rounds * n + (cfg.rest > 0 ? cfg.rounds * n - 1 : 0);
}

/**
 * Etapa `i`: { k: 'prep' | 'work' | 'rest', m (estação), r (rodada), sec (null: aberta),
 * round (descanso entre rodadas), emom }. Null depois do fim.
 */
export function stepAt(cfg, stations, i) {
  const n = stations?.length || 0;
  if (!cfg || !n || i < 0 || i >= stepCount(cfg, n)) return null;
  if (i === 0) return { k: 'prep', m: 0, r: 0, sec: PREP_SEC };
  const j = i - 1;
  const own = (m) => {
    const s = stations[m];
    return s && s.mode === 'time' && s.sec > 0 ? s.sec : null;
  };
  if (cfg.mode === 'amrap') {
    const m = j % n;
    return { k: 'work', m, r: Math.floor(j / n), sec: own(m) };
  }
  if (cfg.mode === 'emom') return { k: 'work', m: j % n, r: Math.floor(j / n), sec: cfg.every, emom: true };
  if (cfg.mode === 'circuit') {
    const gap = cfg.gap > 0;
    const rr = cfg.roundRest > 0;
    const perRound = n + (gap ? n - 1 : 0);
    const block = perRound + (rr ? 1 : 0);
    const r = Math.floor(j / block);
    const p = j % block;
    if (p === perRound) return { k: 'rest', m: 0, r: r + 1, sec: cfg.roundRest, round: true };
    if (!gap) return { k: 'work', m: p, r, sec: own(p) };
    return p % 2 === 0 ? { k: 'work', m: p / 2, r, sec: own(p / 2) } : { k: 'rest', m: (p + 1) / 2, r, sec: cfg.gap };
  }
  // intervalos
  if (cfg.rest > 0) {
    const w = Math.floor(j / 2);
    const m = w % n;
    const r = Math.floor(w / n);
    if (j % 2 === 0) return { k: 'work', m, r, sec: cfg.work };
    const next = w + 1;
    const round = next % n === 0;
    return { k: 'rest', m: next % n, r: Math.floor(next / n), sec: round && cfg.roundRest > 0 ? cfg.roundRest : cfg.rest, round };
  }
  return { k: 'work', m: j % n, r: Math.floor(j / n), sec: cfg.work };
}

/** A próxima etapa de trabalho depois da etapa `i` (o "A seguir"), ou null. */
export function nextWorkAfter(cfg, stations, i) {
  for (let k = i + 1; k < i + 4 + (stations?.length || 0) * 2; k++) {
    const s = stepAt(cfg, stations, k);
    if (!s) return null;
    if (s.k === 'work') return s;
  }
  return null;
}

/** Duração total em segundos quando todas as etapas são fixas (EMOM, intervalos; AMRAP: o tempo), senão null. */
export function plannedLength(cfg, stations) {
  if (!cfg) return null;
  if (cfg.mode === 'amrap') return cfg.cap;
  const total = stepCount(cfg, stations.length);
  let sec = 0;
  for (let i = 1; i < total; i++) {
    const s = stepAt(cfg, stations, i);
    if (s.sec == null) return null;
    sec += s.sec;
  }
  return sec;
}

/* ---------- a execução ---------- */

/** Nova execução, parada na 1ª etapa (preparar). Dados puros: sobrevive a recarregar a página. */
export function startRun({ cfg, stations }, now = Date.now()) {
  return { v: 1, cfg: cleanCircuit(cfg), stations, i: 0, at: now, startedAt: now, paused: null, capEndsAt: null, split: null, log: [], ended: null, adj: {} };
}

export const runStep = (run) => (run ? stepAt(run.cfg, run.stations, run.i) : null);

/** Quando a etapa atual acaba pelo relógio (ms), ou null (etapa aberta). */
export function stepEndsAt(run) {
  const s = runStep(run);
  if (!s || s.sec == null) return null;
  return run.at + s.sec * 1000;
}

/** Segundos que faltam na etapa (ou no tempo do AMRAP numa etapa aberta), em `now`. */
export function leftOf(run, now = Date.now()) {
  const t = run?.paused ?? now;
  const end = stepEndsAt(run);
  if (end != null) return Math.max(0, Math.ceil((end - t) / 1000));
  if (run?.capEndsAt) return Math.max(0, Math.ceil((run.capEndsAt - t) / 1000));
  return null;
}

/** Segundos desde o início do trabalho (depois do preparar). */
export function elapsedOf(run, now = Date.now()) {
  const t = run?.paused ?? now;
  return run?.workFrom == null ? 0 : Math.max(0, Math.floor((t - run.workFrom) / 1000));
}

function begin(run, i, at, events) {
  const step = stepAt(run.cfg, run.stations, i);
  if (!step) {
    run.ended = run.ended || 'done';
    run.endedAt = at;
    events.push({ type: 'end', reason: 'done', at });
    return;
  }
  run.i = i;
  run.at = at;
  run.split = null;
  if (step.k !== 'prep' && run.workFrom == null) run.workFrom = at;
  // O tempo do AMRAP começa no 1º trabalho, nunca durante o preparar.
  if (run.cfg.mode === 'amrap' && step.k === 'work' && run.capEndsAt == null) run.capEndsAt = at + run.cfg.cap * 1000;
  events.push({ type: 'step', step, i, at });
}

function closeWork(run, at, events, { skipped = false } = {}) {
  const step = runStep(run);
  if (!step || step.k !== 'work') return;
  // EMOM: registrado no "Feito" (split); o fim do intervalo só avança o relógio.
  if (step.emom && run.split && run.log[run.log.length - 1]?.i === run.i) return;
  const from = run.at;
  const to = step.emom && run.split ? run.split : at;
  const now = stationNow(run, step.m) || {};
  const entry = { i: run.i, m: step.m, r: step.r, from, to, reps: now.reps || 0, ...(now.w ? { w: now.w } : {}), ...(skipped ? { skipped: true } : {}) };
  run.log.push(entry);
  events.push({ type: skipped ? 'skip' : 'work', ...entry, sec: Math.max(1, Math.round((to - from) / 1000)) });
}

/**
 * Leva o relógio até `now`: cada etapa fixa que acabou fecha no seu horário e a próxima começa
 * ali; o tempo do AMRAP encerra a execução. Retorna { run, events } (run copiado).
 */
export function tickRun(prev, now = Date.now()) {
  if (!prev || prev.ended || prev.paused != null) return { run: prev, events: [] };
  const run = { ...prev, log: [...prev.log] };
  const events = [];
  for (let guard = 0; guard < 2000 && !run.ended; guard++) {
    const end = stepEndsAt(run);
    const cap = run.capEndsAt;
    if (cap != null && now >= cap && (end == null || cap <= end)) {
      // Acabou o tempo: a estação aberta é a parcial (as reps são perguntadas depois).
      const step = runStep(run);
      run.ended = 'cap';
      run.endedAt = cap;
      run.partial = step?.k === 'work' ? { m: step.m, r: step.r } : null;
      events.push({ type: 'end', reason: 'cap', at: cap });
      break;
    }
    if (end == null || now < end) break;
    closeWork(run, end, events);
    begin(run, run.i + 1, end, events);
  }
  return { run, events };
}

/** "Feito": etapa aberta fecha agora e a próxima começa; no EMOM só marca quando terminou. */
export function doneStep(prev, now = Date.now()) {
  const ticked = tickRun(prev, now);
  if (!ticked.run || ticked.run.ended || ticked.run.paused != null) return ticked;
  const run = { ...ticked.run, log: [...ticked.run.log] };
  const events = [...ticked.events];
  const step = runStep(run);
  if (step.k === 'work' && step.emom) {
    if (!run.split) {
      run.split = now;
      closeWork(run, now, events);
      events.push({ type: 'split', i: run.i, at: now });
    }
    return { run, events };
  }
  if (step.k === 'work') closeWork(run, now, events);
  begin(run, run.i + 1, now, events);
  return { run, events };
}

/** "Pular": a estação fica de fora (nada registrado); descanso ou preparar acaba agora. */
export function skipStep(prev, now = Date.now()) {
  const ticked = tickRun(prev, now);
  if (!ticked.run || ticked.run.ended || ticked.run.paused != null) return ticked;
  const run = { ...ticked.run, log: [...ticked.run.log] };
  const events = [...ticked.events];
  const step = runStep(run);
  if (step.k === 'work') {
    if (step.emom && run.split) closeWork(run, now, events);
    else closeWork(run, now, events, { skipped: true });
  }
  begin(run, run.i + 1, now, events);
  return { run, events };
}

export function pauseRun(run, now = Date.now()) {
  if (!run || run.ended || run.paused != null) return run;
  return { ...tickRun(run, now).run, paused: now };
}

/** Continuar: todos os relógios andam o tempo que ficou parado. */
export function resumeRun(run, now = Date.now()) {
  if (!run || run.paused == null) return run;
  const d = Math.max(0, now - run.paused);
  const mv = (v) => (v == null ? v : v + d);
  return {
    ...run,
    paused: null,
    at: run.at + d,
    split: mv(run.split),
    capEndsAt: mv(run.capEndsAt),
    workFrom: mv(run.workFrom),
    startedAt: run.startedAt + d,
    log: run.log.map((x) => ({ ...x })),
  };
}

/** Encerrar aqui: a execução termina agora com o que foi registrado. */
export function stopRun(prev, now = Date.now()) {
  if (!prev || prev.ended) return { run: prev, events: [] };
  const t = prev.paused ?? now;
  const { run: r0, events } = tickRun({ ...prev, paused: null }, t);
  const run = { ...r0, log: [...r0.log] };
  if (!run.ended) {
    const step = runStep(run);
    run.ended = 'stopped';
    run.endedAt = t;
    run.partial = step?.k === 'work' && !step.emom ? { m: step.m, r: step.r } : null;
    if (step?.k === 'work' && step.emom && run.split) closeWork(run, t, events);
    events.push({ type: 'end', reason: 'stopped', at: t });
  }
  return { run, events };
}

/** O que a tela mostra para a estação `m`: o plano com os ajustes feitos no player. */
export function stationNow(run, m) {
  const s = run?.stations?.[m];
  if (!s) return null;
  const a = run.adj?.[m] || {};
  return { ...s, ...(a.reps != null ? { reps: a.reps } : {}), ...(a.w != null ? { w: a.w } : {}) };
}

/** Ajusta reps ou carga da estação `m` para as próximas rodadas. */
export function adjustStation(run, m, field, value) {
  const v = Math.max(0, Number(value) || 0);
  return { ...run, adj: { ...run.adj, [m]: { ...(run.adj?.[m] || {}), [field]: field === 'reps' ? Math.round(v) : Math.round(v * 100) / 100 } } };
}

/* ---------- virando treino ---------- */

/**
 * Monta os exercícios do treino a partir do registro: cada estação feita vira uma série
 * concluída ({ weight, reps, done, sec? }) do exercício, na ordem das rodadas.
 * `routineExercises` dá nome e foto; `partialReps` são as reps da estação em que o tempo acabou.
 */
export function workoutExercises(run, routineExercises, { partialReps = 0 } = {}) {
  const out = (routineExercises || []).map((e) => ({ id: e.id, name: e.name, gif: e.gif, rest: e.rest ?? 0, circuit: run.cfg, sets: [] }));
  for (const x of run.log) {
    if (x.skipped) continue;
    const st = run.stations[x.m];
    const ex = out[st?.idx];
    if (!ex) continue;
    // Por tempo (estação cronometrada ou intervalo): guarda os segundos; as reps não são contadas
    const timed = st.mode === 'time' || run.cfg.mode === 'intervals';
    const sec = Math.max(1, Math.round((x.to - x.from) / 1000));
    ex.sets.push(timed ? { weight: x.w || '', reps: '', sec, done: true } : { weight: x.w || '', reps: x.reps, done: true });
  }
  // AMRAP: a estação em que o tempo acabou entra com as reps que a pessoa disse ter feito
  const p = run.partial;
  const pr = Math.max(0, Math.round(Number(partialReps) || 0));
  if (p && pr > 0 && run.cfg.mode === 'amrap') {
    const st = run.stations[p.m];
    const now = stationNow(run, p.m) || {};
    if (out[st?.idx]) out[st.idx].sets.push({ weight: now.w || '', reps: pr, done: true });
  }
  return out.filter((e) => e.sets.length > 0);
}

/**
 * O que o treino guarda da execução: { mode, ids, rounds, extra, roundTimes, sec, cfg, ended }.
 * `rounds` rodadas completas, `extra` reps da rodada seguinte (o "+ 4" do AMRAP), `roundTimes`
 * os segundos de cada rodada completa (da 1ª à última estação, descanso entre rodadas fora).
 */
export function runResult(run, { partialReps = 0 } = {}) {
  const n = run.stations.length;
  const work = run.log.filter((x) => !x.skipped);
  const byRound = new Map();
  for (const x of work) {
    const g = byRound.get(x.r) || [];
    g.push(x);
    byRound.set(x.r, g);
  }
  let rounds = 0;
  const roundTimes = [];
  for (let r = 0; byRound.has(r) && new Set(byRound.get(r).map((x) => x.m)).size === n; r++) {
    rounds++;
    const g = byRound.get(r);
    roundTimes.push(Math.max(1, Math.round((Math.max(...g.map((x) => x.to)) - Math.min(...g.map((x) => x.from))) / 1000)));
  }
  let extra = 0;
  for (const x of byRound.get(rounds) || []) if (run.stations[x.m]?.mode === 'reps') extra += Math.max(0, Math.round(x.reps || 0));
  extra += Math.max(0, Math.round(Number(partialReps) || 0));
  const from = run.workFrom ?? run.startedAt;
  const sec = Math.max(0, Math.round(((run.endedAt ?? from) - from) / 1000));
  return {
    mode: run.cfg.mode,
    ids: run.stations.map((s) => s.id),
    rounds,
    extra,
    roundTimes,
    sec,
    cfg: run.cfg,
    ended: run.ended || 'stopped',
  };
}

/** O resultado de circuito guardado num treino salvo, ou null. */
export const resultOfWorkout = (w) => (w?.exercises || []).find((e) => e?.circuitResult)?.circuitResult || null;

/** O último resultado do mesmo circuito (mesmo modo e exercícios). `workouts` mais recentes primeiro. */
export function previousResult(workouts, result) {
  const key = (r) => r.mode + '|' + (r.ids || []).join(',');
  const want = key(result);
  for (const w of workouts || []) {
    const r = resultOfWorkout(w);
    if (r && key(r) === want) return r;
  }
  return null;
}

/**
 * Hoje contra a última vez: AMRAP pelo placar, os outros pelo tempo da rodada que mais mudou
 * (delta negativo = mais rápido). { kind: 'rounds'|'reps'|'round'|'same', delta, round } ou null.
 */
export function compareResult(today, last) {
  if (!today || !last) return null;
  if (today.mode === 'amrap') {
    if (today.rounds !== last.rounds) return { kind: 'rounds', delta: today.rounds - last.rounds };
    if (today.extra !== last.extra) return { kind: 'reps', delta: today.extra - last.extra };
    return { kind: 'same' };
  }
  let best = null;
  const k = Math.min(today.roundTimes?.length || 0, last.roundTimes?.length || 0);
  for (let r = 0; r < k; r++) {
    const delta = today.roundTimes[r] - last.roundTimes[r];
    if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { kind: 'round', round: r + 1, delta };
  }
  return best && best.delta !== 0 ? best : best ? { kind: 'same' } : null;
}

/**
 * Para a próxima vez, por estação: estação de reps sem carga que bateu as reps em todas as
 * rodadas ganha +1 rep; estação por tempo de circuito/AMRAP ganha +5 s.
 * [{ idx, id, field: 'reps' | 'sec', from, to }]
 */
export function stationSuggestions(run) {
  const out = [];
  if (!run || run.ended === 'stopped') return out;
  run.stations.forEach((s, m) => {
    const rows = run.log.filter((x) => x.m === m && !x.skipped);
    if (!rows.length) return;
    // Nos intervalos quem manda é o relógio (as reps nem são contadas): nada de +1 rep
    if (run.cfg.mode !== 'intervals' && s.mode === 'reps' && !(s.w > 0) && s.reps > 0 && rows.every((x) => (Number(x.reps) || 0) >= s.reps))
      out.push({ idx: s.idx, id: s.id, field: 'reps', from: s.reps, to: s.reps + 1 });
    else if (s.mode === 'time' && s.sec > 0 && ['circuit', 'amrap'].includes(run.cfg.mode))
      out.push({ idx: s.idx, id: s.id, field: 'sec', from: s.sec, to: s.sec + 5 });
  });
  return out;
}

/* ---------- textos ---------- */

/** Relógio: 0:20, 1:00, 12:30, 1:05:00. */
export function fmtClock(sec) {
  const n = Math.max(0, Math.round(Number(sec)) || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = String(n % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
