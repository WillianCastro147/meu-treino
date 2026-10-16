// Importar histórico de outros apps (CSV exportado do Hevy ou do Strong).
// Funções puras, testadas em lib/fase2.test.mjs.

// ---------- CSV ----------

// Lê CSV com aspas ("a, b"), aspas escapadas ("") e separador , ou ; (detectado na 1ª linha)
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export function detectFormat(rows) {
  const keys = Object.keys(rows[0] || {});
  if (keys.includes('exercise_title') && keys.includes('start_time')) return 'hevy';
  if (keys.includes('Exercise Name') && keys.includes('Date')) return 'strong';
  return null;
}

// ---------- Valores ----------

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(v * 100) / 100;
const LB = 0.45359237;

// "11 Oct 2025, 18:02" (Hevy), "2025-10-11 18:02:00" (Strong) ou ISO
export function parseDate(s) {
  const str = String(s || '').trim();
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], +iso[4], +iso[5], +(iso[6] || 0));
  const d = new Date(str.replace(',', ''));
  return Number.isNaN(d.getTime()) ? null : d;
}

// "1h 5m", "45m", "3600" (segundos) -> minutos
export function parseDuration(s) {
  const str = String(s || '').trim();
  if (/^\d+$/.test(str)) return Math.round(Number(str) / 60);
  const h = str.match(/(\d+)\s*h/);
  const m = str.match(/(\d+)\s*m/);
  return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0);
}

const HEVY_TYPE = { warmup: 'warmup', dropset: 'drop', failure: 'failure' };
const STRONG_TYPE = { W: 'warmup', D: 'drop', F: 'failure' };

// ---------- Nome do exercício -> catálogo ----------

export const normName = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// "Bench Press (Barbell)" -> ["bench press barbell", "barbell bench press", "bench press"]
export function nameCandidates(name) {
  const m = String(name || '').match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return [normName(name)];
  return [normName(name), normName(`${m[2]} ${m[1]}`), normName(m[1])];
}

// Índice nome normalizado (inglês) -> exercício do catálogo
export function buildNameIndex(list) {
  const idx = new Map();
  (list || []).forEach((e) => {
    const k = normName(e.name?.en);
    if (k && !idx.has(k)) idx.set(k, e);
  });
  return idx;
}

function toExercise(title, index) {
  for (const c of nameCandidates(title)) {
    const hit = index.get(c);
    if (hit) return { id: hit.id, name: hit.name.en, gif: hit.gif };
  }
  // Fora do catálogo: guarda o nome original, com uma chave estável
  return { id: 'custom:' + normName(title), name: title, gif: null };
}

// ---------- CSV -> treinos ----------

// Retorna { workouts: [{ name, started_at, duration_min, exercises }], unmatched: [nomes] }
export function toWorkouts(rows, format, index) {
  const groups = new Map();
  const unmatched = new Set();

  rows.forEach((r) => {
    let key, name, start, minutes, title, set;
    if (format === 'hevy') {
      start = parseDate(r.start_time);
      const end = parseDate(r.end_time);
      key = `${r.title}|${r.start_time}`;
      name = r.title;
      minutes = start && end ? Math.round((end - start) / 60000) : 0;
      title = r.exercise_title;
      const kg = r.weight_kg !== undefined && r.weight_kg !== '' ? num(r.weight_kg) : num(r.weight_lbs) * LB;
      set = { weight: round2(kg) || '', reps: num(r.reps) || '', done: true };
      const type = HEVY_TYPE[r.set_type];
      if (type) set.type = type;
      if (num(r.rpe)) set.rpe = num(r.rpe);
    } else {
      start = parseDate(r.Date);
      key = `${r['Workout Name']}|${r.Date}`;
      name = r['Workout Name'];
      minutes = parseDuration(r.Duration);
      title = r['Exercise Name'];
      const unit = (r['Weight Unit'] || '').toLowerCase();
      const w = num(r.Weight);
      set = { weight: round2(unit === 'lbs' ? w * LB : w) || '', reps: num(r.Reps) || '', done: true };
      const type = STRONG_TYPE[String(r['Set Order']).trim().toUpperCase()];
      if (type) set.type = type;
      if (num(r.RPE)) set.rpe = num(r.RPE);
    }
    if (!start || !title) return;
    if (!groups.has(key)) groups.set(key, { name: name || 'Workout', started_at: start.toISOString(), duration_min: Math.max(1, minutes || 1), exercises: [] });
    const w = groups.get(key);
    let ex = w.exercises.find((e) => e._title === title);
    if (!ex) {
      ex = { ...toExercise(title, index), _title: title, rest: 60, sets: [] };
      if (ex.id.startsWith('custom:')) unmatched.add(title);
      w.exercises.push(ex);
    }
    ex.sets.push(set);
  });

  const workouts = [...groups.values()]
    .map((w) => ({ ...w, exercises: w.exercises.map(({ _title, ...e }) => e) }))
    .sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
  return { workouts, unmatched: [...unmatched] };
}

// Tira os treinos que já existem (mesmo minuto de início)
export function dropExisting(workouts, existing) {
  const seen = new Set((existing || []).map((w) => Math.floor(new Date(w.started_at).getTime() / 60000)));
  return workouts.filter((w) => !seen.has(Math.floor(new Date(w.started_at).getTime() / 60000)));
}
